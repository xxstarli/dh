# Doraemon supplied-PNG visual QA

final result: passed

Source: user-supplied seven PNGs (originals archived under backups/v1.2.0/unused-source-assets/), plus layout reference docs/ui/首页UI_哆啦A梦主题_V1.png (1536×1024).
Implementation: docs/evidence/doraemon-png/chrome-home.png and edge-home.png, 1536×1024 CSS px, DPR 1. User explicitly replaces the earlier generated character/SVG scenery with these supplied PNGs; exact original character placement is not a requirement.
Full comparison: docs/evidence/doraemon-png/compare-home.png, 3072×1064, two 1:1 views plus caption. E2E fixture has six categories/30 cards with original fallback icons; development data remains one category/one site.

## Iteration history

- First PNG integration: character artwork slightly clipped at top; top clouds too low/dense. Evidence: iteration-1-home.png.
- Fixed with 130px character image box positioned so visible content is complete; cloud moved upward to -250px with .62 opacity. Screenshot recaptured and final full E2E rerun.
- Category accent now takes its own flex space, preserving truncation for long custom names.

## Final visual assessment

- Bright pale sky gradient, local transparent cloud depth, restrained pink/yellow accents. White cards with 14px corners, light blue edge/shadow, original text hierarchy and 2px hover motion.
- Independent smiling brand Logo and supplied waving character; no theme art in dialogs. Main title/subtitle unchanged. Search/management controls do not intersect the character horizontally.
- Scenery has pointer-events:none, is out of document flow and below content. Character/scenery hidden or reduced responsively. Original five/four/three/two grid, all links displayed, left aligned partial rows.
- Normal, management, login, add/edit website, mobile management and mobile dialog screenshots inspected. Adding/editing categories uses unchanged shared native dialog styling and passes existing E2E.
- Full/region inspection confirms consistent spacing, text readability, intact image aspect ratios and preserved alpha. Original system font stack retained; test data names/icons differ from reference intentionally.
- Final Chrome/Edge full suite 12/12; PHP 147 assertions and persistence restart pass. One intermediate Edge new-tab visibility failure did not reproduce in isolated traced rerun or final full run; cause unconfirmed, documented in full report. No production business changes made to address it.

No remaining P0/P1/P2 visual issues within the requested skin-only scope. P3/boundaries: source PNGs total about 4.8 MiB, kept lossless as requested; mobile real hardware/Safari/remote production not tested. Unused generated assets have been archived outside the release. Local preview http://localhost:3000. Full report: docs/哆啦A梦主题_验收报告.md.

## V1.2.0 final acceptance — 2026-09-13

Final full run after development-only HTML output buffering: Chrome 6/6, Edge 6/6, 46.5 seconds. lint, typecheck, PHP 13 groups/147 assertions, transport security, restart persistence and build passed. Original HTML main/card completeness is now asserted in both browser responsive scenarios. Production PHP business files and JavaScript remain byte-identical to v1.1.0.

One earlier Edge run received malformed HTML missing the closing header/opening main segment; the captured response proves this preceded client rendering. Four isolated Edge repeats and 240 browser loads did not reproduce it. Development router output buffering limits small writes; the exact intermittent transport cause remains unconfirmed. Evidence is retained in backups/v1.2.0/failed-edge-response/. No errors were suppressed or expectations weakened.

Fresh Chrome/Edge read-only development checks: seven PNGs loaded, zero console/page errors, zero failed/404 resources, 1536/1200/900/390/360 widths yield 5/4/3/2/2 columns without overflow. Normal/admin/login/add/edit/mobile screenshots inspected. Production backup/deployment/Smoke Test remain pending authenticated SSH access; this is not a claim of completed production acceptance. See docs/V1.2.0发布验收.md.
