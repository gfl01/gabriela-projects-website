/* Gabriela Projects Selections: website backend.
 * Gives the app the same small set of functions it uses inside Claude (db, user, assets, downloads),
 * backed by Supabase: email sign-in links, a documents table with per-project access, and photo storage.
 * Settings live in config.js (project URL + public anon key).
 */
(() => {
  const CFG = window.GP_CONFIG || {};
  window.GP_WEB = true;
  const ready = !!(CFG.url && CFG.anonKey && window.supabase);
  const sb = ready ? window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } }) : null;
  const BUCKET = 'assets';
  window.GP_BLOB = id => `${CFG.url}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(id)}`;

  // ---------- sign-in screen ----------
  const css = `
  .gp-login{position:fixed;inset:0;z-index:100;background:#F2F2EF;display:grid;place-items:center;padding:24px;font-family:"Figtree",-apple-system,"Segoe UI",Roboto,sans-serif;color:#151515}
  .gp-card{background:#fff;border:1px solid #DDDCD6;border-radius:14px;padding:28px 26px;width:min(420px,100%);display:flex;flex-direction:column;gap:14px}
  .gp-card .g{width:44px;height:44px;border:1.5px solid #151515;display:grid;place-items:center;font-family:"Bebas Neue",Impact,sans-serif;font-size:32px;padding-top:3px}
  .gp-card h1{font-family:"Bebas Neue",Impact,sans-serif;font-weight:400;font-size:34px;letter-spacing:.03em;margin:0;line-height:1}
  .gp-card p{margin:0;color:#55544F;font-size:14.5px;line-height:1.5}
  .gp-card input{font:inherit;border:1px solid #DDDCD6;border-radius:8px;padding:11px 12px;background:#F2F2EF}
  .gp-card button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:11px 14px;background:#151515;color:#fff;cursor:pointer}
  .gp-card button:disabled{opacity:.5}
  .gp-card .msg{font-size:13.5px;color:#2E7650}
  .gp-card .err{font-size:13.5px;color:#B03A2A}
  .gp-out{background:transparent;border:1px solid #3a3a37;color:#F4F4F1;border-radius:6px;padding:6px 10px;font:inherit;font-size:12.5px;cursor:pointer}
  .gp-imp{position:fixed;right:16px;bottom:16px;z-index:50;background:#fff;border:1px solid #DDDCD6;border-radius:12px;padding:14px;width:min(380px,calc(100% - 32px));font-size:13.5px;display:flex;flex-direction:column;gap:8px;box-shadow:0 10px 30px rgba(0,0,0,.15)}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function loginScreen(note){
    const el = document.createElement('div'); el.className = 'gp-login';
    el.innerHTML = `<form class="gp-card" autocomplete="on"><div class="g" aria-hidden="true">G</div><h1>Finish selections</h1>
      <p>Sign in with the email Gabriela Projects has on file for your project. We'll send you a sign-in link — no password needed.</p>
      <label for="gpEmail" style="font-size:12.5px;color:#55544F">Email</label><input id="gpEmail" type="email" required placeholder="you@email.com">
      <button type="submit">Email me a sign-in link</button><div class="msg" role="status"></div>${note?`<div class="err">${note}</div>`:''}</form>`;
    document.body.appendChild(el);
    el.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = el.querySelector('button'), msg = el.querySelector('.msg'), email = el.querySelector('#gpEmail').value.trim();
      btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Sending…';
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      btn.disabled = false;
      if(error){ msg.className = 'err'; msg.textContent = /rate/i.test(error.message) ? 'Too many sign-in emails were sent. Please wait a few minutes and try again.' : 'That did not work: ' + error.message; }
      else msg.textContent = `Check ${email} for your sign-in link. You can close this tab.`;
    });
  }

  // ---------- session ----------
  let sessionP = null;
  function session(){
    if(sessionP) return sessionP;
    sessionP = new Promise(async resolve => {
      if(!sb){ document.addEventListener('DOMContentLoaded', () => loginScreen('The app is not connected yet (config.js is missing its Supabase settings).')); return; }
      const { data } = await sb.auth.getSession();
      if(data.session) return resolve(data.session);
      const show = () => { if(!document.querySelector('.gp-login')) loginScreen(); };
      if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
      sb.auth.onAuthStateChange((_ev, s) => { if(s){ document.querySelector('.gp-login')?.remove(); resolve(s); } });
    });
    return sessionP;
  }
  const email = s => String(s?.user?.email || '').toLowerCase();

  // ---------- documents (same shape as the app's store: collections and docs by path) ----------
  const projectOf = path => path.split('/')[1] || '';
  const collOf = path => path.split('/').slice(0, -1).join('/');
  const idOf = path => path.split('/').pop();
  const cache = new Map();            // path -> data
  const listeners = new Map();        // collection path -> Set(fn)
  const snap = coll => ({ docs: [...cache.entries()].filter(([p]) => collOf(p) === coll).map(([p, d]) => ({ id: idOf(p), data: () => d })) });
  const emit = coll => (listeners.get(coll) || new Set()).forEach(fn => { try{ fn(snap(coll)); }catch(e){ console.error(e); } });
  const loaded = new Set();
  const err = e => { const x = new Error(e.message || 'failed'); x.code = /row-level|permission|violates/i.test(e.message||'') ? 'invalid_argument' : (e.code || 'failed'); return x; };

  async function loadColl(coll){
    const { data, error } = await sb.from('docs').select('path,data').eq('coll', coll);
    if(error) throw err(error);
    [...cache.keys()].filter(p => collOf(p) === coll).forEach(p => cache.delete(p));
    data.forEach(r => cache.set(r.path, r.data));
    loaded.add(coll);
  }
  let channel = null;
  function live(){
    if(channel) return;
    channel = sb.channel('docs').on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, ev => {
      const row = ev.new && ev.new.path ? ev.new : ev.old; if(!row || !row.path) return;
      if(ev.eventType === 'DELETE') cache.delete(row.path); else cache.set(row.path, ev.new.data);
      const c = collOf(row.path); if(loaded.has(c)) emit(c);
    }).subscribe();
    // catch up after the tab sleeps or the connection drops
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') [...loaded].forEach(c => loadColl(c).then(() => emit(c)).catch(()=>{})); });
  }

  // set = create or replace (designers); update = change an existing record (clients may update their rooms)
  async function write(path, data, existing){
    const row = { path, coll: collOf(path), project_id: projectOf(path), data, updated_at: new Date().toISOString() };
    const { error } = existing ? await sb.from('docs').update({ data, updated_at: row.updated_at }).eq('path', path) : await sb.from('docs').upsert(row);
    if(error) throw err(error);
    cache.set(path, data); emit(row.coll);
  }
  const db = {
    collection: coll => ({
      onSnapshot(fn, onErr){
        if(!listeners.has(coll)) listeners.set(coll, new Set());
        listeners.get(coll).add(fn); live();
        loadColl(coll).then(() => fn(snap(coll))).catch(e => onErr && onErr(e));
        return () => listeners.get(coll)?.delete(fn);
      },
      async get(){ await loadColl(coll); return snap(coll); }
    }),
    doc: path => ({
      async get(){ const { data } = await sb.from('docs').select('data').eq('path', path).maybeSingle(); return { exists: !!data, data: () => data?.data }; },
      set: data => write(path, data),
      async update(patch){
        let cur = cache.get(path);
        if(cur === undefined){ const { data, error } = await sb.from('docs').select('data').eq('path', path).maybeSingle(); if(error) throw err(error); if(!data){ const x = new Error('not found'); x.code = 'not_found'; throw x; } cur = data.data; }
        return write(path, { ...cur, ...patch }, true);
      },
      async delete(){ const { error } = await sb.from('docs').delete().eq('path', path); if(error) throw err(error); cache.delete(path); emit(collOf(path)); }
    })
  };

  // ---------- who is viewing ----------
  let designerP = null;
  const isDesigner = () => designerP || (designerP = session().then(async s => {
    const { data } = await sb.from('designers').select('email').eq('email', email(s)).maybeSingle();
    return !!data;
  }));
  const user = { isOwner: () => isDesigner(), canEdit: () => isDesigner(), can: async () => true };

  // ---------- photos ----------
  const hex = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  const assets = {
    async upload(file, id){
      id = id || hex();
      const { error } = await sb.storage.from(BUCKET).upload(id, file, { contentType: file.type || 'image/jpeg', upsert: true, cacheControl: '31536000' });
      if(error) throw err(error);
      return { id, url: window.GP_BLOB(id), sizeBytes: file.size, contentType: file.type };
    },
    async delete(id){ await sb.storage.from(BUCKET).remove([id]); }
  };

  // ---------- downloads ----------
  const downloads = { async save({ filename, data }){ const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } };

  // ---------- the same entry point the app uses inside Claude ----------
  window.claude = {
    async use(name){
      if(!sb) return new Promise(() => {});      // not configured: stay on the sign-in notice
      await session();
      if(name === 'db') return db;
      if(name === 'user') return user;
      if(name === 'assets') return (await isDesigner()) ? assets : null;
      if(name === 'downloads') return downloads;
      return null;
    }
  };

  // sign-out button in the header, and the one-time importer for designers (open the page with #import)
  const domReady = () => new Promise(r => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r) : r());
  session().then(async s => {
    await domReady();
    const band = document.querySelector('.band-in');
    if(band){ const b = document.createElement('button'); b.className = 'gp-out'; b.textContent = 'Sign out'; b.title = email(s);
      b.onclick = async () => { await sb.auth.signOut(); location.reload(); }; band.appendChild(b); }
    if(location.hash === '#import' && await isDesigner()) importer();
  });

  function importer(){
    const box = document.createElement('div'); box.className = 'gp-imp';
    box.innerHTML = `<b>Import projects</b><span>Choose the <code>gp-selections-import.json</code> file.</span><input type="file" accept=".json,application/json"><div class="st"></div>`;
    document.body.appendChild(box);
    box.querySelector('input').onchange = async e => {
      const f = e.target.files[0]; if(!f) return;
      const stEl = box.querySelector('.st'), bundle = JSON.parse(await f.text());
      const A = Object.entries(bundle.assets || {}), D = Object.entries(bundle.docs || {});
      let n = 0;
      for(const [id, dataUrl] of A){ const b = await (await fetch(dataUrl)).blob(); await assets.upload(b, id); stEl.textContent = `Photos ${++n} / ${A.length}`; }
      n = 0;
      for(let i = 0; i < D.length; i += 200){
        const rows = D.slice(i, i + 200).map(([path, data]) => ({ path, coll: collOf(path), project_id: projectOf(path), data }));
        const { error } = await sb.from('docs').upsert(rows); if(error){ stEl.textContent = 'Error: ' + error.message; return; }
        n += rows.length; stEl.textContent = `Records ${n} / ${D.length}`;
      }
      stEl.textContent = `Done: ${A.length} photos and ${D.length} records imported. Reloading…`;
      setTimeout(() => { location.hash = ''; location.reload(); }, 1500);
    };
  }
})();
