# FLAWEN / Telegram identity

50 section banners (1280×720), four avatars (512×512), and 54 editable project JSON files. Built from the existing FLAWEN vector identity and ten editorial compositions; rendered and exported through FLAWEN STUDIO. No AI image generation.

- `sections-overview.png`: all section artwork.
- `avatars-overview.png`: four bot identities.
- `projects/`: import any JSON into Studio to edit text, logo, layout or surface.
- `manifest.json`: exported dimensions and browser errors.
- `avatar-*.jpg`: JPEG format conversions of the Studio PNGs for Telegram profile-photo API uploads.

Recreate with Studio running on port 5180: `node scripts/export-bot-identity.mjs`. An alternative local URL can be supplied through `STUDIO_URL`.

Runtime copies live in the ecosystem repository under `Bots/branding/assets`. Participant start/finish/results and numbered offer banners remain in the earlier picture collection. Clone mirrors original chat content without branding overlays; only administrative replies receive these banners.
