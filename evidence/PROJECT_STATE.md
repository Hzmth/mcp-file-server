# PROJECT_STATE
READ THIS FIRST. UPDATE IT BEFORE YOU STOP.

## Session protocol
1. START: read this file, then search PLAN_LOG.md and CHECKPOINTS.md for the latest entries.
2. WORK: write your plan in PLAN_LOG.md before acting. Read before you write. Keep reads small (use search_files).
3. LOG: after each step, add one line to PLAN_LOG.md. To add a line, use str_replace on the marker "<!-- NEXT ENTRY ABOVE -->".
4. END: update "Current status" and "Next step" below, add a snapshot to CHECKPOINTS.md, record any choices in DECISIONS.md, then call git_commit.

## Goal
Static roadmap.sh-style demo site in `site/`. The Timeline tab first shows a dark role grid (31 roles); only "Junior Backend Engineer" is clickable and opens the milestone timeline. Clicking a milestone opens a RIGHT side panel with description, prerequisites, outcomes, project, skills, recommendation and links. For reuse as a demo in another project.

## Current status
Half 2 DONE (2026-10-17): grid-first view, dark theme, right panel, extra milestone details, README updated. NOT yet viewed in a browser: layout vs. the screenshot is unverified.

## Next step
(1) Open site/index.html and compare to the screenshot (spacing, the grid's "Learn with AI" card, New badges); (2) mobile check; (3) verify resource URLs (no network in workspace); (4) delete leftovers test.txt and notes/hello.txt if unwanted.

## Files that matter
- site/index.html, site/styles.css, site/data.js (all content), site/app.js
- README.md
- PLAN_LOG.md, CHECKPOINTS.md, DECISIONS.md
- test.txt and notes/hello.txt are leftovers, unrelated to the site
