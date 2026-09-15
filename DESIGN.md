# CiviTrack — Connected City Dashboard System

## Typography
- **Typeface**: Locally bundled Inter Variable, with Inter / sans-serif fallback.
- **Hierarchy**: 30–44px page titles, 20px section headings, 15–16px body text, 12–14px metadata. Small uppercase kickers identify sections, not essential report data.

## Color Palette (Dark Theme Optimized)
- **Foundation**: Ink (`#0b111b`), raised slate panels (`#121e2d`), and defined borders (`#2b3c50`).
- **Action**: Blue (`#2563eb`); pale mint highlights the citizen's primary reporting action.
- **Semantic colours**: Blue for assigned reports; cyan for work in progress; amber for high priority; green for completion; red for critical priority. Always accompany colour with a text label.
- **Depth**: Restrained tinted gradients, 12–22px corners, subtle shadows. No animated decorative counters or invented activity.

## Motion & Easing
- **Primary Easing**: Exponential Ease-Out (`cubic-bezier(0.16, 1, 0.3, 1)`)
- **Avoid**: Bounce-easing on structural interactive items.
- **Accessibility**: Honour reduced-motion preferences, retain visible keyboard focus, and keep descriptions untruncated.

## Three Role-Specific Layouts

- **Central Room**: District selector → real summary counts → critical-report shortcut → map and case inspector → searchable register. Summary cards filter the real complaint queue. Case details retain exact reporting time, location, description, and assignment controls. No SLA widgets.
- **Citizen**: Community welcome panel → personal reporting counts → three-step report guide → photo/description and location/review → expandable tracking cards with complaint progress. Choosing a photo still starts location capture; AI text only appears on request.
- **Officer**: Focused welcome panel → assignment summary → searchable personal work queue. Opening a case reveals evidence, location, progress, and a work submission form. No other officer's assignments are included.

## Components and Implementation

`frontend/src/components/DashboardKit.tsx` provides shared hero, metric, status, issue icon, progress, and empty-state components. The civic illustration is original CSS, requiring no remote assets. `frontend/src/styles/workspaces.css` owns the dashboard design system and responsive overrides. The existing APIs, permissions, and integration behaviour are preserved.

Dashboard structure is informed by the open-source sidebar, section-card, and data-table patterns at https://ui.shadcn.com/blocks; no commercial template or additional dependency was installed.

## Verification

### Inspection and approval workflow

Reported → assigned for inspection → officer confirms real with an on-site photo → awaiting Central Room approval → Central Room clicks Proceed → same officer performs work → completion photo and notes → resolved. An officer may instead decline a fake/unverifiable report with a photo and reason; declined cases cannot proceed. The API enforces these transitions, ownership, and photo validation, not just the UI.

The citizen scanner now uses the bundled trained YOLO model for actual bounding boxes. During location capture and inference it shows explicit detecting states; after detection the image displays normalised prediction boxes and a highlighted issue panel. The previous fixed dummy box is not used. Model predictions still require human verification.

The Central Room supports newest-first, oldest-first, and priority sorting alongside district and status filters. Progress indicators distinguish inspection, verification, approved work, resolution, and decline.

`frontend/tests/workspaces.cjs` checks desktop, tablet, and mobile layout alongside district filters, assignment, officer actions, opt-in AI text, location changes, permission errors, and report submission. APIs are intercepted in these UI tests, so real reports and outbound messaging are not affected.
