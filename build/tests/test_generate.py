"""Generator tests. Run: python3 -m unittest discover -s build/tests"""
import json, pathlib, re, sys, tempfile, unittest
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent)); sys.path.insert(0, str(HERE))
import generate, model, linkcheck


class GenerateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.site = pathlib.Path(cls.tmp.name) / 'site'
        generate.generate(cls.site)
        cls.data = json.loads(re.sub(r'^window\.CH_DATA=|;\s*$', '', (cls.site / 'data.js').read_text()))
        cls.recs = {r['id']: r for r in cls.data['records']}
        cls.raw, cls.sources = model.load()

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_all_records_rendered(self):
        self.assertEqual(len(self.recs), len(self.raw))

    def test_every_fact_has_citation(self):
        for r in self.data['records']:
            for f in r['facts']:
                self.assertTrue(f['cites'], f"{r['id']}.{f['field']} rendered without citation")
                for n in f['cites']:
                    self.assertTrue(1 <= n <= len(r['cites']))
                for d in f['disagreements']:
                    self.assertTrue(d['cites'])

    def test_every_source_fact_is_rendered(self):
        for raw in self.raw:
            self.assertEqual(len(raw['facts']), len(self.recs[raw['id']]['facts']), raw['id'])

    def test_citation_numbers_are_sequential(self):
        for r in self.data['records']:
            self.assertEqual([c['n'] for c in r['cites']], list(range(1, len(r['cites']) + 1)), r['id'])

    def test_excerpts_on_source_pages(self):
        for raw in self.raw:
            for f in raw['facts']:
                for c in f['citations']:
                    page = (self.site / 'sources' / f"{c['source_id']}.html").read_text()
                    import html
                    self.assertIn(html.escape(c['excerpt'], quote=True), page, raw['id'])

    def test_citation_links_resolve(self):
        errors, n_cite, _ = linkcheck.check(self.site)
        self.assertEqual(errors, [])
        self.assertEqual(n_cite, sum(len(r['cites']) for r in self.data['records']))

    def test_placeholders_marked(self):
        for raw in self.raw:
            if raw['status'] == 'placeholder':
                self.assertEqual(self.recs[raw['id']]['status'], 'placeholder')
                self.assertIn('Still being researched', self.recs[raw['id']]['note'])
        self.assertIn('inc', self.recs)
        self.assertIn('Still being researched', (self.site / 'app.js').read_text())

    def test_no_draft_banner(self):
        for f in [self.site / 'index.html', self.site / 'bibliography.html', self.site / 'about.html']:
            t = f.read_text()
            self.assertNotIn('class="banner"', t)
            self.assertNotRegex(t, r'(?i)design mockup|draft data')

    def test_outside_lane_label(self):
        lane = next(l for l in self.data['lanes'] if l['id'] == 'non')
        self.assertEqual(lane['name'], 'Outside the historic creeds (Nicene and Chalcedonian)')
        self.assertTrue(lane['muted'])

    def test_overlays_have_influenced(self):
        ov = [r for r in self.data['records'] if r['overlay']]
        self.assertGreaterEqual(len(ov), 6)
        for r in ov:
            self.assertTrue(r['influenced'])
            for i in r['influenced']:
                self.assertIn(i, self.recs)

    def test_serif_only(self):
        css = (self.site / 'style.css').read_text()
        self.assertNotRegex(css, r'(?i)sans-serif|arial|helvetica|system-ui')
        for fam in re.findall(r'font-family:([^;}]+)', css):
            self.assertRegex(fam, r'serif|var\(--serif\)|"EB Garamond"')

    def test_bibliography_lists_used_sources(self):
        bib = (self.site / 'bibliography.html').read_text()
        used = {c['source_id'] for r in self.raw for f in r['facts'] for c in f['citations']}
        for sid in used:
            self.assertIn(f'sources/{sid}.html', bib)


if __name__ == '__main__':
    unittest.main()
