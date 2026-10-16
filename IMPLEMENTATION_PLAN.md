# Claude Code Implementation Plan — **DO NOT EXECUTE YET**

## Permission gate
This is a proposed build sequence, **not authorization** to change repository files, install dependencies, contact external services, publish a site or send messages. Wait for explicit user approval to begin.

## At start of approved implementation
1. Inspect repository, existing framework, package manager and constraints. Do not overwrite unrelated work.
2. Read `README.md`, `DESIGN_SYSTEM.md`, `PAGE_BLUEPRINTS.md`, `CONTENT.md`, `CATALOG.json` and view `references/approved-design.png`.
3. Present a concise implementation plan, page list, component tree, content/data model and image sourcing plan before writing code.
4. Respect user author/commit policy if provided; do not invent author or AI co-author credits.

## Build gates
**Gate A:** Mobile homepage and menu only. User compares actual browser screenshots against approved image; revise before expanding. Evaluate 375×812 and 390×844 screenshots, text contrast, product card styling, navigation and realistic content.
**Gate B:** Desktop homepage and menu; verify 1440px and tablet layouts.
**Gate C:** Cake detail, custom-cake guided inquiry, atelier, seasonal collections, about/contact, WhatsApp review flow.
**Gate D:** Functional testing, keyboard and screen-reader checks, image optimization, responsive regression, copy and data audit.

## Functional acceptance
- All 23 cake records displayed accurately at reference half-kg prices.
- Seven custom examples and eight seasonal example records are preserved without fabricated availability.
- Functional search, category filters, navigation, back behavior and state persistence in custom flow.
- Valid WhatsApp deep link uses +91 90289 02800 and prepopulates an accurate editable inquiry; never silently send.
- Seasonal demo campaigns clearly tagged, inactive historic promotion not live.
- No unsupported rating, testimonial, delivery or allergen claim.
- No broken images, overflowing mobile text, unclickable CTAs or fake success states.
- Real cake portfolio and conceptual imagery are distinguishable.

## Visual acceptance
The user-approved collage is a **directional source of truth**, not a pixel-perfect UI kit. Match mood, spatial hierarchy, mobile menu treatment and typography; improve accessibility and real-world usability. Do not replace the menu with white generic product grids or crowd the hero with slogans. Capture and inspect screenshots for each gate. Present differences explicitly and request approval.

## Deferred until client acceptance
Real product photography, rights clearance, finalized pricing, delivery coverage, true business hours, admin CMS, seasonal scheduling, payment gateway, inventory, live Instagram integration and production deployment.
