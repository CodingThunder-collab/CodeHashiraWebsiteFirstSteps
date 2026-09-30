# Code Hashira — Breath of Code

A blog of sharp, practical Salesforce tips. Each post is one "form" — a single technique
you can learn in two minutes.

Plain HTML + CSS, no build step. Open `index.html` in a browser, or host it free on GitHub Pages
(Settings → Pages → Deploy from branch → root).

## Structure

```
index.html                 Home page (hero, latest form, the dojo, about, subscribe)
tips/<slug>.html           One page per form (tip)
assets/css/style.css       All styles (light + dark theme)
assets/js/main.js          Theme toggle, footer year, placeholder subscribe form
assets/logo.svg            Logo / favicon
```

## Publishing a new form

1. Copy `tips/casesafeid-18-character-ids.html` to `tips/<new-slug>.html` and edit the content.
2. In `index.html`, update the "Latest form" block and replace the next "Coming soon" card in "The dojo".
3. Form numerals: 壱 1 · 弐 2 · 参 3 · 肆 4 · 伍 5 · 陸 6 · 漆 7 · 捌 8 · 玖 9 · 拾 10
