#!/usr/bin/env python3
"""Build the service, town and guide pages from content-pages/*.html.

Each file in content-pages/ holds one page's text plus a short header of
settings. This script wraps it in the site's own head, header and footer --
copied from services.html at build time, so the new pages always match the
hand-edited ones -- and writes the finished page (e.g. kitchen-renovation.html,
guides/glen-ridge-historic-district.html). It then refreshes sitemap.xml and
the structured data on every page.

    python3 tools/build-content-pages.py

Edit the text in content-pages/, never the generated .html files: they are
overwritten on every run. content-pages/ itself is not published (see
.assetsignore).

Settings header format (one "key: value" per line, ended by a line of ---):

    file: kitchen-renovation.html          output path, relative to the site root
    url: /kitchen-renovation               clean URL the page is served at
    title: ...                             <title>, also used for link previews
    description: ...                       meta description (aim for 140-160 chars)
    h1: Kitchen Renovation                 big title at the top of the page
    sub: ...                               descriptive line inside the h1
    hero: images/portfolio/...jpg          top photo
    hero_alt: ...
    crumb: Kitchen Renovation              last breadcrumb item
    parent: Services|/services             optional middle breadcrumb (name|url)
    nav: services                          which menu item to mark active, or none
    type: service | town | guide           guides also get Article structured data
    published: 2026-09-25                  guides only
    cta_title: ...                         optional, closing call-to-action headline
"""

import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content-pages")
SITE = "https://gabrielaprojects.com"

# Hand-edited pages that belong in the sitemap, in addition to the built ones.
STATIC_PAGES = [("/", "1.0"), ("/services", "0.8"), ("/how-it-works", "0.8"),
                ("/projects", "0.8"), ("/projects/park-avenue", "0.7"),
                ("/projects/upper-east-side", "0.7"), ("/projects/montclair-tudor", "0.7"),
                ("/get-started", "0.9")]

NAV_HREF = {"home": "/", "services": "/services", "how-it-works": "/how-it-works",
            "projects": "/projects", "get-started": "/get-started"}


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as fh:
        return fh.read()


def absolute_assets(html):
    """Relative asset paths break inside /guides/; make them root-relative."""
    return re.sub(r'(src|href)="(images|css|js)/', r'\1="/\2/', html)


def template_parts():
    s = read("services.html")
    gtag = re.search(r"<head>\n(.*?)\n  <meta charset", s, re.S).group(1)
    assets = re.search(r'(  <link rel="preconnect".*?)</head>', s, re.S).group(1)
    header = re.search(r"(  <!-- Header -->.*?</header>)", s, re.S).group(1)
    footer = re.search(r"(  <!-- Footer -->.*?</footer>)", s, re.S).group(1)
    mainjs = re.search(r'(  <script src="js/main\.js[^"]*"></script>)', s).group(1)
    header = header.replace(' class="active"', "").replace('class="nav-cta active"', 'class="nav-cta"')
    return {k: absolute_assets(v) for k, v in
            dict(gtag=gtag, assets=assets, header=header, footer=footer, mainjs=mainjs).items()}


def parse(path):
    raw = open(path, encoding="utf-8").read()
    head, body = raw.split("\n---\n", 1)
    meta = {}
    for line in head.strip().splitlines():
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    for need in ("file", "url", "title", "description", "h1", "sub", "hero", "hero_alt", "crumb", "type"):
        if not meta.get(need):
            sys.exit(f"{os.path.basename(path)}: missing '{need}'")
    meta["body"] = body.strip("\n")
    return meta


def esc(text):
    return text.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def render(m, t):
    url = SITE + m["url"]
    image = f'{SITE}/{m["hero"]}'
    header = t["header"]
    if m.get("nav", "none") in NAV_HREF:
        href = NAV_HREF[m["nav"]]
        header = header.replace(f'<a href="{href}">', f'<a href="{href}" class="active">', 1)

    crumbs = ['<a href="/">Home</a>']
    if m.get("parent"):
        pname, purl = m["parent"].split("|")
        crumbs.append(f'<a href="{purl}">{pname}</a>')
    crumbs.append(f'<span aria-current="page">{m["crumb"]}</span>')

    cta_title = m.get("cta_title") or "Planning a renovation in Essex County?"
    title_attr = esc(m["title"].replace("&amp;", "&"))
    desc_attr = esc(m["description"].replace("&amp;", "&"))

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
{t["gtag"]}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Built by tools/build-content-pages.py from content-pages/. Edit that file, not this one. -->
  <title>{m["title"]}</title>
  <meta name="description" content="{desc_attr}">
  <link rel="canonical" href="{url}">
  <!-- Open Graph -->
  <meta property="og:title" content="{title_attr}">
  <meta property="og:description" content="{desc_attr}">
  <meta property="og:image" content="{image}">
  <meta property="og:url" content="{url}">
  <meta property="og:type" content="{'article' if m['type'] == 'guide' else 'website'}">
  <meta property="og:site_name" content="Gabriela Projects">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title_attr}">
  <meta name="twitter:description" content="{desc_attr}">
  <meta name="twitter:image" content="{image}">
{t["assets"]}</head>
<body class="content-page">

{header}

  <!-- Page Hero -->
  <section class="page-hero">
    <img src="/{m["hero"]}" alt="{esc(m["hero_alt"])}" loading="eager">
    <div class="overlay"></div>
    <h1>{m["h1"]}<span class="page-hero-sub">{m["sub"]}</span></h1>
  </section>

  <nav class="breadcrumbs" aria-label="Breadcrumb">
    {' <span class="sep" aria-hidden="true">&rsaquo;</span> '.join(crumbs)}
  </nav>

  <main class="article">
{m["body"]}
  </main>

  <!-- CTA -->
  <section class="cta-section">
    <img src="/images/portfolio/park-avenue/after-01.jpg" alt="Park Avenue co-op living room" loading="lazy">
    <div class="overlay"></div>
    <div class="cta-content reveal">
      <h2>{cta_title}</h2>
      <p>Tell us about your home, and we'll get back to you within one business day. Your first consultation is free.</p>
      <a href="/get-started" class="btn-outline">Book a free consultation</a>
    </div>
  </section>

{t["footer"]}

{t["mainjs"]}
</body>
</html>
"""


def write_sitemap(pages, today):
    urls = [(u, p) for u, p in STATIC_PAGES]
    prio = {"service": "0.8", "town": "0.8", "guide": "0.6", "index": "0.6"}
    urls += [(m["url"], prio.get(m["type"], "0.6")) for m in pages]
    rows = "\n".join(
        f"  <url>\n    <loc>{SITE}{u}</loc>\n    <lastmod>{today}</lastmod>\n"
        f"    <changefreq>monthly</changefreq>\n    <priority>{p}</priority>\n  </url>"
        for u, p in urls)
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n'
                 '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                 f"{rows}\n</urlset>\n")


def main():
    import datetime
    today = datetime.date.today().isoformat()
    t = template_parts()
    pages = [parse(os.path.join(CONTENT, f)) for f in sorted(os.listdir(CONTENT)) if f.endswith(".html")]
    for m in pages:
        out = os.path.join(ROOT, m["file"])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as fh:
            fh.write(render(m, t))
        print(f"built {m['file']:48} {m['url']}")
    write_sitemap(pages, today)
    print(f"sitemap.xml: {len(STATIC_PAGES) + len(pages)} URLs")
    subprocess.run([sys.executable, os.path.join(ROOT, "tools", "make-structured-data.py")], check=True,
                   stdout=subprocess.DEVNULL)
    print("structured data refreshed")


if __name__ == "__main__":
    main()
