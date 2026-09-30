# Code Hashira — An IT Farmer

A small blog of practical Salesforce tips, one "seed" at a time.

Plain HTML + CSS, no build step. Open `index.html` in a browser, or host it free on GitHub Pages
(Settings → Pages → Deploy from branch → root).

## Structure

```
index.html                 Home page (hero, latest tip, all tips, about, subscribe)
tips/<slug>.html           One page per tip
assets/css/style.css       All styles (light + dark theme)
assets/js/main.js          Theme toggle, footer year, placeholder subscribe form
assets/logo.svg            Logo / favicon
```

## Publishing a new tip

1. Copy `tips/casesafeid-18-character-ids.html` to `tips/<new-slug>.html` and edit the content.
2. In `index.html`, update the "Latest seed" block and replace the next "Coming soon" card in "The field".
