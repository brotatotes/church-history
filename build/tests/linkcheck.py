#!/usr/bin/env python3
"""Check every internal link in the generated site, including every citation link in data.js.
Exits 1 if any link points to a missing file or a missing anchor."""
import json, pathlib, re, sys
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote


class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = set(); self.hrefs = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a: self.ids.add(a['id'])
        for k in ('href', 'src'):
            if a.get(k): self.hrefs.append(a[k])


def check(site):
    site = pathlib.Path(site); pages = {}
    for f in site.rglob('*.html'):
        p = P(); p.feed(f.read_text()); pages[f.resolve()] = p
    data = json.loads(re.sub(r'^window\.CH_DATA=|;\s*$', '', (site / 'data.js').read_text()))
    errors, n_cite, n_link = [], 0, 0

    def resolve(base, href, origin):
        u = urlsplit(href)
        if u.scheme or u.netloc or href.startswith('mailto:'): return False
        target = (base.parent / unquote(u.path)).resolve() if u.path else base.resolve()
        if not target.exists(): errors.append(f'{origin}: missing file {href}'); return True
        if u.fragment and target.suffix == '.html' and not u.fragment.startswith('g='):
            if u.fragment not in pages[target].ids: errors.append(f'{origin}: missing anchor {href}')
        return True

    for f, p in pages.items():
        for h in p.hrefs:
            n_link += resolve(f, h, str(f.relative_to(site.resolve())))
    index = (site / 'index.html').resolve()
    ids = {r['id'] for r in data['records']}
    for r in data['records']:
        for c in r['cites']:
            n_cite += 1; resolve(index, c['href'], f"{r['id']}[{c['n']}]")
        for f in r['facts']:
            if f.get('link') and f['link'] not in ids: errors.append(f"{r['id']}: split_from link to unknown {f['link']}")
    # back links from source pages to cards must name existing records
    for f, p in pages.items():
        for h in p.hrefs:
            m = re.search(r'#g=([\w-]+)$', h)
            if m and m.group(1) not in ids: errors.append(f'{f.name}: back link to unknown record {m.group(1)}')
    return errors, n_cite, n_link


if __name__ == '__main__':
    site = sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[2] / 'site'
    errors, n_cite, n_link = check(site)
    print(f'{n_cite} citation links and {n_link} page links checked, {len(errors)} errors')
    for e in errors[:50]: print(' ', e)
    sys.exit(1 if errors else 0)
