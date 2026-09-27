"""Copy the finishes catalog into the Selections app.

Reads a finishes-db folder (data/finishes.json + images/<slug>.png) and writes:
  selections/finishes/<slug>.webp   320px swatches, small enough for phones
  selections/finishes/finishes.json the catalog the app falls back to when the
                                    Supabase "finishes" table is not reachable

Usage:  python tools/build-finishes-web.py "<path to finishes-db folder>"
Run it again after editing finishes_data.py and rebuilding the catalog, then commit.
"""
import json
import sys
from pathlib import Path

from PIL import Image

SIZE = 320
FIELDS = ['slug', 'name', 'rooms', 'category', 'subcategory', 'material', 'styles', 'color_family', 'color_hex',
          'finish', 'size', 'price_tier', 'popularity', 'example_brands', 'notes', 'sort_order']

src = Path(sys.argv[1] if len(sys.argv) > 1 else 'finishes-db')
out = Path(__file__).resolve().parent.parent / 'selections' / 'finishes'
out.mkdir(parents=True, exist_ok=True)

rows = json.loads((src / 'data' / 'finishes.json').read_text(encoding='utf-8'))
missing = []
for r in rows:
    png = src / 'images' / f"{r['slug']}.png"
    if not png.exists():
        missing.append(r['slug'])
        continue
    im = Image.open(png).convert('RGB')
    im.thumbnail((SIZE, SIZE), Image.LANCZOS)
    im.save(out / f"{r['slug']}.webp", 'WEBP', quality=82, method=6)

catalog = [{k: r.get(k) for k in FIELDS} for r in rows]
(out / 'finishes.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

kb = sum(p.stat().st_size for p in out.glob('*.webp')) / 1024
print(f'{len(catalog)} finishes, {len(rows) - len(missing)} images ({kb:.0f} KB) -> {out}')
if missing:
    print('No image for:', ', '.join(missing))
