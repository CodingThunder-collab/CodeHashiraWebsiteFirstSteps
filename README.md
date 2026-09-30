# Code Hashira — Salesforce, Sharpened

A community blog of short, practical Salesforce tips for admins, developers and tech enthusiasts.

Plain HTML + CSS, no build step. Open `index.html` in a browser, or host it free on GitHub Pages
(Settings → Pages → Deploy from branch → root).

## Structure

```
index.html                 Home page (hero, latest tip, the dojo, about)
tips/<slug>.html           One page per tip
games/governor-limit-runner.html   Break-room game page
assets/css/style.css       Site styles (light theme)
assets/css/governor-limit-runner.css   Game panel styles
assets/js/main.js          Footer year
assets/js/governor-limit-runner.js     Game engine (canvas, no dependencies)
assets/logo.svg            Logo / favicon (original artwork)
```

## Publishing a new tip

1. Copy `tips/lwc-if-elseif-else.html` to `tips/<new-slug>.html` and edit the content.
2. In `index.html`, update the "Latest tip" block and replace the next "Coming soon" card in "The dojo".

## Content and branding notes

- All text, code samples, the logo and the game's pixel art are original. Fonts (Fraunces, Inter,
  JetBrains Mono, Noto Serif JP, Silkscreen) are served from Google Fonts under the SIL Open Font License.
- "Hashira" (柱) is used in its everyday Japanese meaning: a structural pillar. Avoid names,
  characters, move names or artwork from anime, games or other franchises.
- Salesforce is referenced only to describe the topic. Keep the footer disclaimer, don't use
  Salesforce logos or the Astro/Codey characters, and link to official docs rather than copying them.
