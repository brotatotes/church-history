# Christian Church History

An interactive timeline of Christian churches, divisions and movements in which every fact is cited to an approved source, with the supporting excerpt stored and shown.

Live site: https://brotatotes.github.io/church-history/

## Contents
- `data/` research records. `entries/` holds churches and movements, `events/` holds events, and `sources.json` is the source registry. Each fact carries one or more citations with a verbatim excerpt, a locator and a link.
- `build/` the site generator (Python 3, standard library only) and its static assets.
- `build/tests/` generator tests and a link checker that proves every citation link resolves to an excerpt anchor.
- `docs/` the generated site served by GitHub Pages.

## Build and test
```
python3 build/generate.py docs
python3 -m unittest discover -s build/tests
python3 build/tests/linkcheck.py docs
```

Entries marked "Still being researched" have no approved source yet for a start date or relationship. See the About page for the method.
