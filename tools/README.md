# tools

Small helper scripts for the site. Nothing here is served to visitors.

## `devserver.py` — local preview

```bash
python3 tools/devserver.py 8080
```

Serves the site the way Cloudflare does: extensionless URLs (`/portfolio`, not
`/portfolio.html`) and the custom `404.html` for unknown paths. Plain
`python3 -m http.server` does neither, so every internal link 404s under it.

## `make-og-image.py` — the link-preview image

```bash
python3 tools/make-og-image.py
```

When someone pastes the site link into iMessage, WhatsApp, Instagram, Facebook
or LinkedIn, the preview card shows **one fixed image file**, named by the
`og:image` and `twitter:image` tags in `index.html`. Nothing picks it from the
page automatically, so it goes stale the moment a hero photo changes.

This rebuilds `images/common/og-home.jpg` as a 1200×630 version of the hero —
the same three photos, column proportions, per-panel crop centres and dark
overlay. It reads all of that back out of `index.html` and `css/style.css`, so
**changing a hero photo and re-running this is all that is needed**; there is no
second place to update.

One caveat: the site's heading face, Cormorant Garamond, is a webfont and is not
installed locally, so the wordmark falls back to the closest system serif
(Baskerville). It is a near match, not an exact one. Dropping
`CormorantGaramond-Light.ttf` into `/Library/Fonts/` makes it exact — the script
already looks there first.

### Keeping it automatic

A pre-commit hook regenerates the image whenever a commit touches
`index.html`, `css/style.css` or anything in `images/`. Enable it once per
clone — git does not share hooks automatically:

```bash
git config core.hooksPath tools/git-hooks
```

The hook only rewrites the file when it would actually change, stages it for
you, and warns rather than blocking the commit if it cannot run.
