#!/usr/bin/env python3
"""Resolve grocery catalog image subjects from freely licensed Wikimedia sources.

Every subject is resolved deterministically and the choice is written to an
attribution manifest:

  article  keyword-scored file from that Wikipedia article's own image list
  lead     the article's lead image
  file     a pinned Commons file title
  reuse    the same file another subject already uses
  from     a collage of the subjects listed

Nothing is picked by open keyword search across all of Commons, because that
happily answers "milk bottle" with a chocomilk bottle and "atta" with a regional
pancake. Scoring inside one article keeps the image both on-topic and auditable:
the chosen filename is printed and recorded, so a wrong pick is obvious in review.
"""

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BACKEND = "/Applications/MAMP/htdocs/all-in-one-delivery-ride-application/backend"
PLAN = os.path.join(BACKEND, "database", "catalog-image-sources.json")
MANIFEST = os.path.join(BACKEND, "database", "catalog-image-attribution.json")
COMMONS = "https://commons.wikimedia.org/w/api.php"
WIKI = "https://en.wikipedia.org/w/api.php"
UA = "SuperBasketCatalogNormalizer/1.0 (local dev; contact: dev@localhost)"
TILE_W = 900
TILE_H = 675
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".wikimedia-cache")
MIN_INTERVAL = 0.7
_last_call = [0.0]


def get(api, params):
    """Cached, throttled API read. Wikimedia answers 429 readily to bursts."""
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.sha1((api + "?" + json.dumps(params, sort_keys=True)).encode()).hexdigest()
    path = os.path.join(CACHE, key + ".json")
    if os.path.exists(path):
        return json.load(open(path))

    url = api + "?" + urllib.parse.urlencode(params)
    for attempt in range(5):
        wait = MIN_INTERVAL - (time.time() - _last_call[0])
        if wait > 0:
            time.sleep(wait)
        _last_call[0] = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.load(r)
            json.dump(data, open(path, "w"))
            return data
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 4:
                raise
            time.sleep(2 ** attempt * 3)
    raise RuntimeError("unreachable")


def wiki_pages(titles):
    """Resolve requested titles to their redirect targets, keyed by the request."""
    mapping = {}
    for i in range(0, len(titles), 20):
        batch = titles[i:i + 20]
        data = get(WIKI, {
            "action": "query", "format": "json", "formatversion": "2",
            "titles": "|".join(batch), "redirects": "1",
        })
        query = data.get("query", {})
        by_title = {p.get("title"): p for p in query.get("pages", [])}
        target = {}
        for r in query.get("normalized", []) + query.get("redirects", []):
            target[r["from"]] = r["to"]
        for title in batch:
            final = target.get(title, title)
            if final in by_title:
                mapping[title] = final
    return mapping


def article_candidates(article):
    """File titles used inside one article, most relevant first."""
    files = wiki_pages([article])
    final = files.get(article, article)
    out = []
    for i in range(0, 1, 1):
        data = get(WIKI, {
            "action": "query", "format": "json", "formatversion": "2", "titles": final,
            "prop": "images", "imlimit": "500", "redirects": "1",
        })
        pages = data.get("query", {}).get("pages", [])
        if not pages:
            break
        out = [im["title"] for im in pages[0].get("images", []) if im.get("title", "").startswith("File:")]
    return out


def article_lead(article):
    final = wiki_pages([article]).get(article, article)
    data = get(WIKI, {
        "action": "query", "format": "json", "formatversion": "2", "titles": final,
        "prop": "pageimages", "piprop": "name", "redirects": "1",
    })
    for page in data.get("query", {}).get("pages", []):
        if page.get("pageimage"):
            return "File:" + page["pageimage"].replace(" ", "_")
    return None


def commons_info(title):
    """One title per request: a single bad title must not discard a whole batch."""
    try:
        data = get(COMMONS, {
            "action": "query", "format": "json", "titles": title, "prop": "imageinfo",
            "iiprop": "url|size|extmetadata|mime", "iiurlwidth": str(TILE_W),
        })
    except Exception:
        return None
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        ii = (page.get("imageinfo") or [{}])[0]
        if ii.get("mime") in ("image/jpeg", "image/png") and ii.get("thumburl"):
            return ii
    return None


def clean(html):
    return " ".join(re.sub(r"<[^>]+>", "", html or "").split())[:160]


def score(title, must=(), prefer=(), avoid=()):
    """Rank a candidate filename for a subject.

    A subject that declares `prefer` tokens only accepts a candidate that hits at
    least one of them. Without that, "Germinating tomatoes.jpg" wins a tomato
    search on the strength of the word "tomato" alone, which is exactly the kind of
    near-miss this task exists to remove.
    """
    low = re.sub(r"[^a-z0-9]+", " ", title.lower())
    if must and not any(m.lower() in low for m in must):
        return -100
    hits = [p for p in prefer if p.lower() in low]
    if prefer and not hits:
        return -100
    value = 10 * sum(1 for m in must if m.lower() in low)
    value += 8 * len(hits)
    value -= 14 * sum(1 for a in avoid if a.lower() in low)
    if any(w in low for w in ("commons", "icon", "logo", "map of", "chart", "diagram", "coat of arms")):
        value -= 25
    return value


def store(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r, open(dest + ".tmp", "wb") as f:
        f.write(r.read())
    os.replace(dest + ".tmp", dest)


def dims(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                         capture_output=True, text=True).stdout.split()
    return f"{out[out.index('pixelWidth:') + 1]}x{out[out.index('pixelHeight:') + 1]}"


def frame(path):
    """Square centre-crop, then downscale: every tile keeps one identical shape."""
    w, h = (int(v) for v in dims(path).split("x"))
    side = min(w, h)
    if w > h:
        subprocess.run(["sips", "-c", str(side), str(side), "--cropOffset", "0", str((w - side) // 2), path],
                       capture_output=True)
    elif h > w:
        subprocess.run(["sips", "-c", str(side), str(side), "--cropOffset", str((h - side) // 2), "0", path],
                       capture_output=True)
    subprocess.run(["sips", "-Z", str(TILE_H), path], capture_output=True)
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "80", path, "--out", path],
                   capture_output=True)


def collage(parts, dest):
    subprocess.run(["php", os.path.join(os.path.dirname(os.path.abspath(__file__)), "collage.php"),
                    dest, str(TILE_H), str(TILE_H)] + parts, capture_output=True, check=True)


def main():
    plan = json.load(open(PLAN))
    subjects = plan["subjects"]

    if sys.argv[1:2] == ["--list"]:
        # Review aid: show how a subject's candidates rank, so a bad pick can be
        # replaced with a pinned Commons file instead of guessed at again.
        spec = subjects[sys.argv[2]]
        ranked = sorted(article_candidates(spec["article"]),
                        key=lambda t: score(t, spec.get("must", []), spec.get("prefer", []),
                                            spec.get("avoid", [])),
                        reverse=True)
        print(f"# {sys.argv[2]} ({spec['article']})")
        for t in ranked[:20]:
            print(f"{score(t, spec.get('must', []), spec.get('prefer', []), spec.get('avoid', [])):>5}  {t}")
        return

    only = sys.argv[1:] or list(subjects)
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}

    leaves = [k for k in only if subjects[k].get("article") or subjects[k].get("lead") or subjects[k].get("file")]
    reused = [k for k in only if subjects[k].get("reuse")]
    composed = [k for k in only if subjects[k].get("from")]

    for key in leaves:
        spec = subjects[key]
        dest_dir = os.path.join(BACKEND, "storage", "app", "public", spec["dir"], "grocery")
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, spec["name"] + ".jpg")

        if spec.get("file"):
            candidates = [spec["file"]]
        elif spec.get("lead"):
            lead = article_lead(spec["article"])
            candidates = [lead] if lead else []
        else:
            candidates = sorted(article_candidates(spec["article"]),
                                key=lambda t: score(t, spec.get("must", []), spec.get("prefer", []),
                                                    spec.get("avoid", [])),
                                reverse=True)

        chosen = None
        for title in candidates[:12]:
            ii = commons_info(title)
            if ii:
                chosen = (title, ii)
                break
        if not chosen:
            print(f"!! {key}: nothing usable for {spec.get('article') or spec.get('file')}")
            continue

        title, ii = chosen
        store(ii["thumburl"], dest)
        frame(dest)
        meta = ii.get("extmetadata", {})
        manifest[key] = {
            "subject": key,
            "file": f"{spec['dir']}/grocery/{spec['name']}.jpg",
            "pixels": dims(dest),
            "wikipedia_article": spec.get("article"),
            "commons_title": title,
            "commons_page": ii.get("descriptionurl"),
            "author": clean(meta.get("Artist", {}).get("value")) or "Wikimedia Commons contributor",
            "license": clean(meta.get("LicenseShortName", {}).get("value")) or "See Commons page",
            "license_url": meta.get("LicenseUrl", {}).get("value", ""),
        }
        print(f"ok {key:30s} {manifest[key]['pixels']:>9s}  {title}  [{manifest[key]['license']}]")

    for key in reused:
        spec = subjects[key]
        source = manifest.get(spec["reuse"])
        if not source:
            print(f"!! {key}: source {spec['reuse']} missing")
            continue
        dest_dir = os.path.join(BACKEND, "storage", "app", "public", spec["dir"], "grocery")
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, spec["name"] + ".jpg")
        shutil.copyfile(os.path.join(BACKEND, "storage", "app", "public", source["file"]), dest)
        manifest[key] = {
            "subject": key, "file": f"{spec['dir']}/grocery/{spec['name']}.jpg",
            "reused_from": spec["reuse"], "commons_page": source.get("commons_page"),
            "author": source.get("author"), "license": source.get("license"),
            "license_url": source.get("license_url", ""), "pixels": source.get("pixels"),
        }
        print(f"ok {key:30s} {source.get('pixels',''):>9s}  = {spec['reuse']}")

    for key in composed:
        spec = subjects[key]
        parts = [os.path.join(BACKEND, "storage", "app", "public", manifest[p]["file"])
                 for p in spec["from"] if p in manifest]
        if not parts:
            print(f"!! {key}: no collage sources ready")
            continue
        dest_dir = os.path.join(BACKEND, "storage", "app", "public", spec["dir"], "grocery")
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, spec["name"] + ".jpg")
        collage(parts, dest)
        manifest[key] = {
            "subject": key, "file": f"{spec['dir']}/grocery/{spec['name']}.jpg",
            "pixels": dims(dest), "composed_from": spec["from"],
            "sources": [manifest[p]["commons_page"] for p in spec["from"] if manifest[p].get("commons_page")],
        }
        print(f"ok {key:30s} {manifest[key]['pixels']:>9s}  collage {' + '.join(spec['from'])}")

    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=4, sort_keys=True)
        f.write("\n")


if __name__ == "__main__":
    main()
