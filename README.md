# Nivya Hospital

Static hospital website with 39 public HTML pages, shared assets, and Vercel payment API functions.

## Structure

- Root HTML files: public pages and policy aliases.
- assets/: styles, scripts, fonts, images, and shared booking-catalog.json.
- api/: Razorpay payment endpoints for Vercel.
- Backend/: separate Express/MySQL backend; excluded from Vercel deployment.
- scripts/: local maintenance and read-only asset checks; excluded from deployment.

## Asset checks

Run node scripts/check-local-assets.js to inventory local references and missing files.
Run node scripts/audit-assets.js to list unreferenced candidates for manual review. It does not delete files. Candidates may include original photography; never delete those automatically.

Keep assets/js/booking-catalog.json: it is shared by the booking page and payment API. Keep HTML policy aliases so existing links continue to work.

For a doctor whose fee is not confirmed, set `feeStatus` to `pending` and both fees to `null` in the booking catalog. Booking shows a call-to-book message and the API rejects payment orders. To enable online payment after hospital confirmation, enter the confirmed positive fees and change `feeStatus` to `confirmed`; update the doctor listing and chatbot fee text at the same time.

## Health blog

Edit `scripts/health-blog-content.json`, then run `node scripts/build-health-blog.js` to rebuild six static article pages and the grid/list indexes. Articles include source links, appropriate health-information notices, and links to the relevant hospital specialty. Do not add a named clinical reviewer unless that person has actually reviewed the article.

`assets/js/health-blog.js` handles article search and category filters. Content remains in the generated HTML for direct links, accessibility and search engines.
