# FLAWEN / Offers 11–50

40 monochrome PNG banners, 1280 × 720. Created and exported through the running FLAWEN STUDIO browser editor, using its ten offer compositions and a distinct surface seed for every number.

- Artwork: `13-offer-11.png` … `13-offer-50.png`.
- Editable projects: `projects/13-offer-11.json` … `projects/13-offer-50.json`.
- Overview: `previews/offers-11-50.png`.
- Export evidence: `offers-11-50-manifest.json` (dimensions, titles, browser errors).

To recreate, run Studio at port 5180, then `node scripts/export-offers-11-50.mjs`. Set `STUDIO_URL` to use another local address. The script edits and exports via the actual interface; it does not render replacement artwork outside the constructor.

Sessions Bot bundles copies of these PNGs. Numbered banners correspond to the offer's position in the session, not its library ID. Offers beyond position 50 use the unnumbered banner.
