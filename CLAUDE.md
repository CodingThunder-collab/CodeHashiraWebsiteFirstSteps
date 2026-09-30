# Code Hashira website: working notes

Static blog of short Salesforce tips, published with GitHub Pages. See `README.md` for structure and content rules.

## Git and pull requests
- **Branch names:** `feature/<short-name>` for new things, `fix/<short-name>` for bug fixes,
  `chore/<short-name>` for housekeeping. Lowercase words joined with hyphens, e.g. `feature/tip-002-soql-for-loops`.
  Never use a `claude/` prefix.
- **Base branch:** always branch from and open PRs into `main`. GitHub Pages publishes from `main`.
- **Commit messages:** short imperative subject line, then a brief body if needed.
  Don't add `Co-Authored-By`, `Claude-Session` or any other tool-attribution lines.
- **PR descriptions:** summary of what changed and how it was tested.
  Don't add "Generated with Claude Code" or similar footers or session links.

## Site conventions
- Plain HTML, CSS and JavaScript with no build step and no frameworks.
- Every page keeps the Content-Security-Policy `<meta>` tag: no inline `<script>` or `style=""` attributes.
  Put scripts in `assets/js/`, styles in `assets/css/`, and set dynamic styles through the CSSOM (`el.style.setProperty`).
- New tip: copy `tips/lwc-if-elseif-else.html`, then update the "Latest tip" block and the next "Coming soon" card in `index.html`.
- Keep the header, nav (Tips · Break room · About) and footer disclaimer the same on every page.
- Branding: follow the README. Reference Salesforce only as the topic, with no Salesforce logos or characters,
  and link to official docs instead of copying them.
- Check changes on a phone-sized screen (360–414px wide) as well as desktop.
