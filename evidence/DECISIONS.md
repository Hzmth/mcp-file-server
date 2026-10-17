# DECISIONS

## 2026-10-16
- Plain HTML/CSS/JS, no framework or build: it's a demo to drop into another project, so zero setup wins.
- All content in site/data.js so it can be swapped without touching rendering code.
- Panel docks LEFT per the user's wording, although the screenshot shows it on the right. Flip with the `panel-right` class (documented in README).
- DOM built with textContent/createElement (no innerHTML) to avoid injection if data is ever user-supplied.
- Data Engineer toggle kept visible but empty, deferred to half 2.

## 2026-10-17
- Panel now on the RIGHT (user request; supersedes the LEFT decision above). The `panel-right` class was removed.
- Timeline tab opens on a roadmap.sh-style role grid (31 roles, dark theme, per screenshot). Only Backend ("Junior Backend Engineer") is clickable; others are disabled demo placeholders.
- Removed the empty Data Engineer track and the track toggle; the grid replaces it. Data Engineer remains a disabled grid card.
- "Remaining details" interpreted as: level, prerequisites, outcomes and capstone project per Backend milestone, shown in the panel.

<!-- NEXT ENTRY ABOVE -->
