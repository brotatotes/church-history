"""Load research data into a site model. Stdlib only.
Plot years are chart positions only. Cards always show the sourced wording."""
import json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'

# Approximate chart positions for sourced values that contain no plain year.
# Chart position only. The card shows the sourced text.
PLOT_YEAR = {
    ('g001', 'start'): 30, ('g002', 'start'): 70, ('g004', 'end'): 500, ('g009', 'end'): 450,
    ('g010', 'end'): 700, ('g011', 'end'): 700, ('g017', 'start'): 451, ('g052', 'end'): 1530,
    ('g057', 'start'): 1536, ('g058', 'start'): 1527, ('g081', 'start'): 1534, ('g092', 'start'): 1693,
    ('g002', 'end'): 400, ('g003', 'end'): 400, ('g006', 'end'): 450, ('g047', 'end'): 1118,
    ('g049', 'end'): 1400, ('g156', 'start'): 1933,
    ('e001', 'start'): 50, ('e002', 'start'): 70, ('e003', 'start'): 64,
}
APPROX_ENDS = {('g002', 'end'), ('g003', 'end'), ('g006', 'end'), ('g047', 'end'), ('g049', 'end'), ('g004', 'end'), ('g009', 'end'), ('g010', 'end'), ('g011', 'end'), ('g052', 'end')}

HISTORICAL_LANES = {'early', 'med'}
# Root line: drawn continuously because later lines branch from it. Chart placement only.
CONTINUING = {'g001'}

def plot_year(rid, field, value):
    if (rid, field) in PLOT_YEAR: return PLOT_YEAR[(rid, field)]
    m = re.search(r'\b(\d{3,4})\b', value)
    if m: return int(m.group(1))
    m = re.search(r'(\d{1,2})(?:st|nd|rd|th) century', value)
    if m:
        c = int(m.group(1)); early = re.search(r'\b(early|beginning)\b', value[:m.start()], re.I); late = re.search(r'\blate\b', value[:m.start()], re.I)
        return (c - 1) * 100 + (10 if early else 85 if late else 50)
    raise ValueError(f'no plot year for {rid} {field}: {value!r}')

def load():
    sources = json.loads((DATA / 'sources.json').read_text())
    recs = []
    for sub in ('entries', 'events'):
        for f in sorted((DATA / sub).glob('*.json')):
            recs.append(json.loads(f.read_text()))
    for r in recs:
        r['kind'] = 'event' if r.get('stream') == 'event' else 'group'
        for x in r['facts']:
            if x['field'] in ('start', 'end'):
                r['plot_' + x['field']] = plot_year(r['id'], x['field'], x['value'])
                if (r['id'], x['field']) in APPROX_ENDS: r['end_approx'] = True
        # No sourced end. Groups known only from history (no current size, early or medieval lane)
        # are drawn with a short fading line instead of running to the present.
        if r['kind'] == 'group' and 'plot_start' in r and 'plot_end' not in r:
            fields = {x['field'] for x in r['facts']}
            if r.get('stream') in HISTORICAL_LANES and 'size_today' not in fields and r['id'] not in CONTINUING:
                r['plot_end'] = r['plot_start'] + 120; r['end_approx'] = True; r['end_unsourced'] = True
    return recs, sources

if __name__ == '__main__':
    recs, src = load()
    print(len(recs), 'records', sum('plot_start' in r for r in recs), 'with plot_start', sum('plot_end' in r for r in recs), 'with plot_end')
