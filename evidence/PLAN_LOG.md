# PLAN_LOG

## Plan: Career Roadmap demo (roadmap.sh style) - 2026-10-16

Goal: a static, dependency-free website (HTML/CSS/JS) matching the screenshot: "AI Career DSS" app shell, a Timeline view for "Junior Backend Engineer" with sequential milestone cards, and a preview side panel with description, skills, and links/recommendations.

Approach: plain static site in `site/` (open index.html, no build). Content lives in `site/data.js` so the demo is easy to reuse in another project.

Phases
- Half 1 (this session): plan, data model, core code (index.html, styles.css, data.js, app.js), README.
- Half 2 (next session): visual polish vs screenshot, mobile layout, keyboard/a11y, second track (Data Engineer) content, manual test pass.

Steps (half 1)
1. [ ] Write plan (this entry)
2. [ ] site/data.js - tracks, milestones, skills, resources
3. [ ] site/index.html - header/nav, track header, milestone list, side panel shell
4. [ ] site/styles.css - roadmap.sh-like look
5. [ ] site/app.js - render timeline, select step, open/close panel, track toggle
6. [ ] README.md
7. [ ] Update PROJECT_STATE.md, CHECKPOINTS.md, DECISIONS.md, git_commit

Open question: user said panel pops up "in the left"; the screenshot shows it on the right. Following the user's words: panel docks LEFT, configurable via one CSS class (`panel-right`).

- [x] Steps 1-6 done: plan, site/data.js, site/index.html, site/styles.css, site/app.js, README.md written (not browser-tested).
- Half 1 complete. Stopping here as instructed; half 2 pending (see PROJECT_STATE.md).

## Plan: Half 2 - 2026-10-16
User changes: (a) panel on the RIGHT, (b) Timeline tab first shows a roadmap.sh-style grid (screenshot: tabs, "Role-based 31", dark cards); only Junior Backend Engineer is clickable and opens the milestone timeline, (c) fill in remaining details.
Steps: 1 dark theme + grid view in styles.css/index.html; 2 app.js: view state (grid -> track), back button, panel right; 3 data.js: roleGrid list, extra milestone details (outcomes, project, prerequisites), drop empty Data Engineer track; 4 README + state files + commit.
- [x] Half 2 steps 1-3 done: index.html (grid + track views), styles.css (dark), app.js (view state, grid, right panel, extra details), data.js (roles grid, milestone extras, Data Engineer track removed). README updated. Not browser-tested.
<!-- NEXT ENTRY ABOVE -->
