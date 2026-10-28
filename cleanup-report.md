# Nivya website cleanup — 28 October 2026

## Result

- Removed **976 tracked files**: 972 unused assets plus four scratch/debug files.
- Removed assets total **183,557,976 bytes (183.6 MB / 175.1 MiB)**, before small source/documentation edits. This reduces the working files and deployment input; Git history still retains the deleted versions.
- Kept original hospital photography in the ignored `admin/assets/img/photos/` directory.
- Kept all 34 public HTML files, including three policy aliases that redirect existing URLs.
- Cleanup was prepared and verified locally. Subsequent publishing is recorded in Git history.

## Removed

Unreferenced template images, old admin demo assets, unused JS/CSS plugins, an unused video, and these scratch files:

- `assets/js/.testimonial-slider-two.txt`
- `medical_icons_found.txt`
- `scripts/show-snippet.js`
- `scripts/test-pattern.js`

The full asset deletion manifest is saved beside the browser screenshots as `removed-assets.json`.

## Source cleanup

- Fixed the homepage diagnostic laboratory paragraph's malformed closing tag, which displayed `/p>` to visitors.
- Replaced obsolete Eye Care footer copy in nine pages with the hospital's respiratory/multispeciality description.
- Removed a stray Markdown fence displayed after the Pulmonology page.
- Replaced duplicate, malformed Blog List/Blog Details headers with the existing Blog Grid header. This removes links to nonexistent admin login and speciality pages.
- Removed links from sample blog author names/images to the nonexistent generic doctor profile. The existing sample authors and article content are retained.
- Updated the two remaining Doccure blog titles to Nivya Hospitals.
- Changed Iconsax font loading to the existing TTF file, removing three nonexistent HTML font fallbacks.
- Repaired the mixed-encoding README and documented the project structure.
- Excluded maintenance scripts, the page generator and local documentation from Vercel deployment input.

## Verification

- Cross-checked asset names against HTML, CSS, JavaScript, JSON, SVG and maintenance sources. Retained explicitly referenced assets, including URL-encoded filenames and the shared payment/booking catalog.
- Compared local dependency inventories before and after: **zero new missing references**; 12 previously missing references resolved.
- Visited all **34 public page URLs** in the local browser and captured full-page screenshots. No failed image elements were reported in those checks. Three policy aliases successfully redirected to their canonical pages.
- Reviewed the homepage, About Us, doctor listing, four profiles, three blog pages, contact page, booking page, 15 speciality pages and seven policy/alias URLs visually.
- Tested the mobile homepage menu opening and the Doctors submenu.
- Tested doctor listing → doctor-specific booking → fastest available slot → patient details. The doctor image, services and fees loaded; no browser error logs were recorded in that booking check.
- Parsed the public pages' three executable inline script blocks and checked both new maintenance scripts for JavaScript syntax errors.
- `git diff --check` passed after whitespace cleanup.

The local preview serves static files. Live payment processing, database operations, message delivery and form submission were not exercised.

## Items retained for a separate content/design pass

- Mobile homepage hero text has poor contrast against its blue background. This was visible during the mobile check and is not caused by asset deletion.
- Blog pages still contain template authors, article content and template SEO metadata. Replace them with approved hospital content before treating them as published hospital articles.
- Some speciality pages reuse generic hospital/respiratory photos. These images are referenced, so they were retained.
- There are **29 pre-existing missing reference entries** remaining: mostly absent social preview images, unused template CSS backgrounds/font fallbacks, and dormant shared-script paths. They are listed in `references-after.json`; no new missing entry was introduced by cleanup.
- Google Maps embeds sometimes appeared blank/black during preview. External embed rendering was not changed.
- Shared template CSS/JS contains conditional behavior for multiple layouts. It was retained where reachability could not be proved safely; dynamically created states should be tested before a deeper rule-by-rule purge.

## Evidence and maintenance

Screenshots, contact sheets, browser image checks, before/after dependency inventories and the deletion manifest:

`C:/Users/vps/.codex/visualizations/2026/10/27/01a17d5d-1aba-7ec1-8a69-ad8e522ca7b8/nivya-cleanup/`

- `node scripts/check-local-assets.js` — read-only dependency inventory with file hashes and missing reference entries.
- `node scripts/audit-assets.js` — conservative, read-only unused-file candidates. Manually review results; original photography may appear as unused.

The Git deletions are reviewable and recoverable from the repository's existing history.
