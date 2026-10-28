#!/usr/bin/env python3
"""Generate the static church history site from data/. Stdlib only.

Usage: python3 build/generate.py [OUTDIR]   (default: site/)

Every fact shown on a card carries numbered citations. Each citation links to an
anchor on a source page (sources/<source_id>.html#c-<record>-<n>) that shows the
stored excerpt, its locator and a link to the original.
"""
import html, json, pathlib, shutil, sys, re
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import model

ROOT = model.ROOT
STATIC = ROOT / 'build' / 'static'
NOW = 2026
OUTSIDE_LABEL = 'Outside the historic creeds (Nicene and Chalcedonian)'

# Display lanes, top to bottom. Names are navigation headings, colours are design choices.
LANES = [
    ('early', 'Early church and ancient movements', '#8a8378'),
    ('east', 'Church of the East and Oriental churches', '#7a5a7c'),
    ('orth', 'Eastern Orthodox churches', '#5d5a8a'),
    ('cat', 'Catholic and independent catholic churches', '#8a6b2c'),
    ('med', 'Medieval dissent and reform', '#5f6e3a'),
    ('lut', 'Lutheran churches', '#4a6585'),
    ('ref', 'Reformed, Presbyterian and Congregational', '#3f6f72'),
    ('ang', 'Anglican churches', '#98606c'),
    ('ana', 'Anabaptist and related Brethren', '#5b7a52'),
    ('bap', 'Baptist churches', '#2f7480'),
    ('free', 'Free church, Quaker and Moravian', '#6f6a3a'),
    ('meth', 'Methodist and Holiness', '#7a5a3c'),
    ('pent', 'Pentecostal churches', '#9a6a3a'),
    ('rest', 'Restorationist and Adventist', '#94593d'),
    ('united', 'United, independent and global churches', '#55697a'),
    ('non', OUTSIDE_LABEL, '#6a655e'),
]
MUTED = {'non'}
FIELD_ORDER = ['start', 'end', 'split_from', 'founders', 'distinctives', 'description', 'size_today']
FIELD_LABEL = {'start': 'Began', 'end': 'Ended', 'split_from': 'Separated from', 'founders': 'Founders and leaders',
               'distinctives': 'Distinctives', 'description': 'Description', 'size_today': 'Size today'}
OVERLAY_COLORS = ['#b58a3c', '#6f8a5a', '#8a6a9a', '#4f7f9a', '#a0644f', '#7a7a50']

esc = lambda s: html.escape(str(s), quote=True)


def tidy(text):
    """Display only: drop the space that HTML extraction leaves before punctuation after a link."""
    return re.sub(r' +([,.;:!?)\]])', r'\1', text)


def slug_anchor(rid, n):
    return f'c-{rid}-{n}'


def build_model():
    recs, sources = model.load()
    by_id = {r['id']: r for r in recs}
    cite_index = {sid: [] for sid in sources}   # source page entries
    out_recs = []
    ov_i = 0
    for r in recs:
        nums = {}      # (sid,url,locator,excerpt) -> n
        cites = []

        def number(c, field_label, value):
            locator = c.get('locator') or ''
            key = (c['source_id'], c['url'], locator, c['excerpt'])
            if key not in nums:
                n = len(nums) + 1
                nums[key] = n
                entry = {'n': n, 'rid': r['id'], 'anchor': slug_anchor(r['id'], n), 'source_id': c['source_id'],
                         'locator': locator, 'url': c['url'], 'page_url': c.get('page_url'),
                         'excerpt': c['excerpt'], 'excerpt_type': c.get('excerpt_type', ''), 'supports': []}
                cites.append(entry)
                cite_index[c['source_id']].append(entry)
            n = nums[key]
            cites[n - 1]['supports'].append({'field': field_label, 'value': value})
            return n

        facts = []
        for f in sorted(r['facts'], key=lambda f: FIELD_ORDER.index(f['field']) if f['field'] in FIELD_ORDER else 99):
            if not f.get('citations'):
                raise SystemExit(f"{r['id']}.{f['field']} has no citation; refusing to render")
            value = f['value']
            shown = by_id[value]['name'] if f['field'] == 'split_from' and value in by_id else value
            fact = {'field': f['field'], 'label': FIELD_LABEL.get(f['field'], f['field']), 'value': shown,
                    'link': value if f['field'] == 'split_from' and value in by_id else None,
                    'precision': f.get('date_precision'),
                    'cites': [number(c, FIELD_LABEL.get(f['field'], f['field']), shown) for c in f['citations']],
                    'disagreements': []}
            for d in f.get('disagreements', []):
                loc = next((c.get('locator') for c in f['citations'] if c['url'] == d['url'] and c['source_id'] == d['source_id']), None)
                if loc is None:
                    loc = next((c.get('locator') for x in r['facts'] for c in x['citations'] if c['url'] == d['url']), None)
                if loc is None:
                    loc = sources[d['source_id']]['short']
                dc = {'source_id': d['source_id'], 'url': d['url'], 'locator': loc, 'excerpt': d['excerpt'],
                      'excerpt_type': 'public_domain' if sources[d['source_id']]['license'] == 'public_domain' else 'short_quote'}
                fact['disagreements'].append({'value': d['value'], 'cites': [number(dc, FIELD_LABEL.get(f['field'], f['field']) + ' (other view)', d['value'])]})
            facts.append(fact)
        o = {'id': r['id'], 'name': r['name'], 'stream': r['stream'], 'kind': r['kind'],
             'parent': r.get('parent'), 'overlay': bool(r.get('overlay')), 'influenced': r.get('influenced') or [],
             'status': r['status'], 'note': r.get('lane_note') or ('Still being researched' if r['status'] == 'placeholder' else ''),
             'start': r.get('plot_start'), 'end': r.get('plot_end'), 'endApprox': bool(r.get('end_approx')), 'endUnsourced': bool(r.get('end_unsourced')),
             'facts': facts,
             'cites': [{'n': c['n'], 'source_id': c['source_id'], 'short': sources[c['source_id']]['short'],
                        'locator': c['locator'], 'href': f"sources/{c['source_id']}.html#{c['anchor']}"} for c in cites]}
        if o['overlay']:
            o['color'] = OVERLAY_COLORS[ov_i % len(OVERLAY_COLORS)]; ov_i += 1
        for k in ('start', 'end'):
            src = next((f['value'] for f in facts if f['field'] == k), None)
            o[k + 'Text'] = src
        out_recs.append(o)
    used = {sid for sid, v in cite_index.items() if v}
    return out_recs, sources, cite_index, used


def page(title, body, depth=0, cls='page'):
    up = '../' * depth
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)} · Christian Church History</title><link rel="stylesheet" href="{up}style.css"></head>
<body class="{cls}"><main><nav class="crumbs"><a href="{up}index.html">Timeline</a> · <a href="{up}bibliography.html">Bibliography</a> · <a href="{up}about.html">About and method</a></nav>
{body}
</main></body></html>
'''


def source_page(sid, s, entries, recs_by_id):
    parts = [f'<h1>{esc(s["short"])}</h1>',
             f'<p class="bib">{esc(s["full_citation"])}</p>',
             '<dl class="meta">',
             f'<dt>Type</dt><dd>{esc(s.get("type", ""))}</dd>',
             f'<dt>Rights</dt><dd>{"Public domain. Longer excerpts are quoted." if s["license"] == "public_domain" else "In copyright. Only short quotations are used."}</dd>',
             f'<dt>Online</dt><dd><a href="{esc(s["url"])}" rel="noopener">{esc(s["url"])}</a></dd>',
             f'<dt>Excerpts used</dt><dd>{len(entries)}</dd></dl>',
             '<h2>Excerpts used on this site</h2>']
    for e in sorted(entries, key=lambda e: (recs_by_id[e['rid']]['name'].lower(), e['n'])):
        rec = recs_by_id[e['rid']]
        sup = ''.join(f'<div class="fact">{esc(x["field"])}: <em>{esc(x["value"])}</em></div>' for x in e['supports'])
        links = f'<a href="{esc(e["url"])}" rel="noopener">Original text</a>'
        if e.get('page_url'):
            links += f' · <a href="{esc(e["page_url"])}" rel="noopener">Printed page image</a>'
        parts.append(f'''<div class="excerpt" id="{esc(e["anchor"])}">
<div class="loc">{esc(rec["name"])} [{e["n"]}] · {esc(e["locator"])}</div>
<blockquote>{esc(tidy(e["excerpt"]))}</blockquote>
{sup}
<div class="supports"><a href="../index.html#g={esc(rec["id"])}">Back to the {esc(rec["name"])} card</a> · {links}</div>
</div>''')
    return page(s['short'], '\n'.join(parts), depth=1)


def bibliography(sources, cite_index):
    groups = {}
    for sid, s in sources.items():
        if cite_index[sid]:
            groups.setdefault(s.get('type', 'Other'), []).append((sid, s))
    parts = ['<h1>Bibliography</h1>',
             '<p>Every work cited on the timeline, grouped by type. Each title opens a page listing every excerpt quoted from it.</p>',
             '<p><input id="bibq" type="search" placeholder="Search the bibliography" aria-label="Search the bibliography" class="bibsearch"></p>']
    for t in sorted(groups):
        parts.append(f'<section class="bibgroup"><h2>{esc(t)}</h2><ul class="biblist">')
        for sid, s in sorted(groups[t], key=lambda x: x[1]['full_citation']):
            parts.append(f'<li data-text="{esc((s["full_citation"] + " " + s["short"]).lower())}"><div><a href="sources/{esc(sid)}.html">{esc(s["full_citation"])}</a>'
                         f'<span class="used">{len(cite_index[sid])} excerpts · {"public domain" if s["license"] == "public_domain" else "in copyright, short quotations"}</span></div></li>')
        parts.append('</ul></section>')
    parts.append('<p id="bibnone" class="smallnote" hidden>No matching works.</p>')
    parts.append('''<script>const q=document.getElementById('bibq');q.addEventListener('input',()=>{const t=q.value.trim().toLowerCase();let any=false;document.querySelectorAll('.biblist li').forEach(li=>{const ok=!t||li.dataset.text.includes(t);li.hidden=!ok;any=any||ok});document.querySelectorAll('.bibgroup').forEach(g=>g.hidden=![...g.querySelectorAll('li')].some(li=>!li.hidden));document.getElementById('bibnone').hidden=any})</script>''')
    return page('Bibliography', '\n'.join(parts))


def about(recs, sources, used):
    n_groups = sum(1 for r in recs if r['kind'] == 'group')
    n_events = sum(1 for r in recs if r['kind'] == 'event')
    n_ph = sum(1 for r in recs if r['status'] == 'placeholder')
    n_cites = sum(len(r['cites']) for r in recs)
    body = f'''<h1>About and method</h1>
<p>This timeline shows {n_groups} Christian churches, movements and families and {n_events} events, from the first century to the present. Every date, relationship and description shown on a card comes from a cited source, and every citation links to the exact excerpt that supports it. The site quotes {n_cites} excerpts from {len(used)} works.</p>
<h2>Sources</h2>
<p>Only an approved list of works is used. Older reference works in the public domain, such as Schaff's <i>History of the Christian Church</i>, the 1913 <i>Catholic Encyclopedia</i> and the 1911 <i>Encyclopaedia Britannica</i>, are quoted at greater length. Modern works in copyright, such as the Pew Research Center reports and the Association of Religion Data Archives, are quoted only in a sentence or two. A church's own published history is used only to describe how the church describes itself, never as proof of a date. Wikipedia is not used. The full list is on the <a href="bibliography.html">bibliography</a> page.</p>
<h2>How each entry was researched</h2>
<p>Each entry was researched from scratch. A fact appears only when an approved source states it, and the supporting words are stored with the fact. Every excerpt was then fetched again from the original and checked word for word, and each value was checked against what its excerpt actually says. Wording was kept plain and neutral. Census figures were compared with images of the printed pages.</p>
<p>When sources disagree, the card marks the date as disputed and shows each view with its own citation. When no approved source could be found for a date or relationship, the field is left out rather than guessed.</p>
<h2>Entries still being researched</h2>
<p>{n_ph} entries are marked <span class="tag ph">Still being researched</span>. They appear so the timeline is complete, but they lack a sourced start date or relationship. They will be filled in when an approved source is found.</p>
<h2>Reading the chart</h2>
<ul class="rules">
<li>Each line runs from a group's sourced start date to its end date or to the present. Lines do not show size.</li>
<li>Where a source gives only a century or a decade, the line is placed at an approximate position. The card always shows the source's own wording.</li>
<li>The time scale is compressed before 1500 so that later centuries have room.</li>
<li>Movements that crossed church boundaries, such as Pietism or the Holiness movement, are drawn as shaded bands across the churches they influenced. They can be switched on and off under Filters.</li>
<li>Groups whose teaching departs from the Nicene and Chalcedonian creeds are shown in a separate, muted lane labelled “{esc(OUTSIDE_LABEL)}”. This is a description of doctrinal position, not a judgement.</li>
<li>Lane headings and colours are for navigation only.</li>
</ul>
<h2>Licences</h2>
<p>Quotations remain the property of their publishers. Public-domain excerpts may be reused freely. The site's text and data structure are offered for reuse with attribution. The EB Garamond font is used under the SIL Open Font License.</p>'''
    return page('About and method', body)


INDEX = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Christian Church History</title>
<meta name="description" content="An interactive, fully cited timeline of Christian churches, divisions and movements.">
<link rel="stylesheet" href="style.css">
</head>
<body class="app">
<header class="masthead">
  <div class="titlerow">
    <h1>Christian Church History</h1>
    <span class="sub">Churches, divisions and movements, with a source for every fact</span>
    <nav aria-label="Pages"><a href="bibliography.html">Bibliography</a><a href="about.html">About</a></nav>
  </div>
  <div class="toolbar">
    <div class="searchwrap">
      <input id="q" type="search" placeholder="Find a group, e.g. Methodists" autocomplete="off" spellcheck="false"
        role="combobox" aria-label="Find a group" aria-controls="results" aria-expanded="false" aria-autocomplete="list">
      <ul id="results" class="results" role="listbox" hidden></ul>
    </div>
    <div class="btngroup" role="group" aria-label="Zoom">
      <button class="btn sq" id="zout" type="button" aria-label="Zoom out" title="Zoom out">−</button>
      <button class="btn sq" id="zin" type="button" aria-label="Zoom in" title="Zoom in">+</button>
      <button class="btn" id="reset" type="button" title="Back to the opening view">Reset</button>
    </div>
    <details class="opts" id="opts">
      <summary class="btn">Filters and key</summary>
      <div class="optpanel">
        <h3>Lanes</h3>
        <div id="lanefilters"></div>
        <h3>Movements across churches</h3>
        <div id="overlayfilters"></div>
        <h3>Branches</h3>
        <div class="btngroup"><button class="btn" type="button" id="expandall">Expand all</button><button class="btn" type="button" id="collapseall">Collapse all</button></div>
        <h3>Key</h3>
        <ul class="key" id="key"></ul>
        <p class="hint">The time scale is compressed before 1500 so that later centuries have room.</p>
      </div>
    </details>
    <span class="lineagechip" id="chip" hidden><span id="chiptext"></span><button type="button" id="chipclear" aria-label="Clear lineage highlight" title="Clear lineage highlight">×</button></span>
  </div>
  <div class="hint"><span class="mouse">Scroll wheel zooms · drag to pan · Shift + wheel scrolls up and down · click a lane to show its branches</span><span class="touch">Pinch to zoom · drag to pan · tap a lane to show its branches</span></div>
</header>
<div class="main">
  <div class="chart" id="chart" tabindex="0" aria-label="Timeline chart. Arrow keys pan, plus and minus zoom.">
    <div class="axis" id="axiswrap"><svg id="axis" aria-hidden="true"></svg></div>
    <div class="body" id="body"><svg id="plot" role="group" aria-label="Church family lanes"></svg></div>
    <div class="tooltip" id="tip" hidden></div>
  </div>
  <aside class="panel" id="panel" hidden aria-live="polite"></aside>
</div>
<noscript><p class="noscript">The interactive timeline needs JavaScript. The <a href="bibliography.html">bibliography</a> and source pages work without it.</p></noscript>
<script src="data.js"></script>
<script src="app.js"></script>
</body>
</html>
'''


def generate(out):
    out = pathlib.Path(out)
    recs, sources, cite_index, used = build_model()
    by_id = {r['id']: r for r in recs}
    if out.exists():
        shutil.rmtree(out)
    (out / 'sources').mkdir(parents=True)
    shutil.copytree(STATIC / 'fonts', out / 'fonts')
    css = (STATIC / 'style.css').read_text().replace('url("../fonts/', 'url("fonts/')
    (out / 'style.css').write_text(css)
    shutil.copy(STATIC / 'app.js', out / 'app.js')
    lanes = [{'id': i, 'name': n, 'color': c, 'muted': i in MUTED} for i, n, c in LANES]
    streams = {r['stream'] for r in recs if r['kind'] == 'group'}
    missing = streams - {l['id'] for l in lanes}
    if missing:
        raise SystemExit(f'no lane for streams {missing}')
    data = {'meta': {'now': NOW, 'generated_from': 'data/', 'outsideLabel': OUTSIDE_LABEL},
            'lanes': lanes, 'records': recs}
    (out / 'data.js').write_text('window.CH_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    (out / 'index.html').write_text(INDEX)
    for sid in used:
        (out / 'sources' / f'{sid}.html').write_text(source_page(sid, sources[sid], cite_index[sid], by_id))
    (out / 'bibliography.html').write_text(bibliography(sources, cite_index))
    (out / 'about.html').write_text(about(recs, sources, used))
    (out / '.nojekyll').write_text('')
    return recs, sources, cite_index, used


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else ROOT / 'site'
    recs, sources, ci, used = generate(out)
    print(f'{len(recs)} records, {sum(len(r["cites"]) for r in recs)} citations, {len(used)} source pages -> {out}')
