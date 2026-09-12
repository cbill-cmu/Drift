# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are young adults: college students and early-career professionals who want more exploration in their lives and stronger social connection. They use Drift with friends or emerging groups, not as solitary trip-logging. The emotional job is to feel daring enough to try new places and to build community through shared movement—not to optimize logistics alone.

## Product Purpose

Drift turns real trips into a shared knowledge graph of places (nodes) and journeys (edges) on top of a group activity heat map. Success means people return week to week: logging movement becomes a habit, the group map grows richer, and taste-based recommendations pull them toward new places and each other. The deeper impact goal is to reduce loneliness and the inertia of “not going out” by making exploration social, visible, and rewarding.

## Positioning

Unlike fitness heatmaps (Strava) or review apps (Yelp), Drift’s product is the **shared discovery graph**: behavior becomes content; new connections between places are celebrated; recommendations come from what you and your group actually do. Neighboring products could copy a map or a feed; they could not truthfully claim “your group’s lived city graph + unlock moments from real trips.”

## Operating Context

- Scoped to Pittsburgh / CMU for the current build; multi-city expansion is explicitly later if time allows.
- Users log trips (manual form today), see a group canvas map (nodes/edges/heat), and experience discovery when someone expands the graph.
- Auth via Auth0; data in MongoDB Atlas; demo path includes a seeded group graph and a live trip (e.g. CMU → Lawrenceville).

## Capabilities and Constraints

**Confirmed now**
- Auth0 login; group graph + heat; trip logging; basic discovery feedback; seeded Pittsburgh data; member/friend map paths (partial).
- Canvas map is acceptable for this phase (Google Maps tiles not required).
- Shared group graph is visible to the group; personal heat density remains more private than node/edge existence.

**Must preserve**
- Pittsburgh / CMU scope until the team deliberately expands.
- Auth0 as the identity gate.
- Graph-first product (never ship heat alone without nodes/edges).
- Discovery “someone unlocked something” as a first-class moment.

**Open / later**
- Full friends API, group create/join, stronger recommendations UI, production deploy, multi-city.

## Brand Commitments

- Product name: **Drift**.
- Voice should feel exploratory and daring—encouraging going out and trying new things—without becoming a generic social feed.
- Visual preference (user-pinned, 2026-09): **soft product standard** — clean soft map UI, white/cream shell, mint accent, simple round nodes, minimal sidebar, obvious Log trip. Soft, modern, easy, minimal. Avoid gritty/historical/industrial costume worlds and heavy chibi/kawaii decoration.

## Evidence on Hand

- Live product docs and demo script in repo (`README.md`, `DRIFT_PROJECT_GUIDE.md`, `requirements.md`).
- Seeded CMU CREW Pittsburgh graph in Atlas; Auth0 tenant in use.
- Do not invent testimonials, usage metrics, or press; none are confirmed.

## Product Principles

1. **Exploration is social** — the group graph and unlock moments matter more than solitary stats.
2. **Behavior is the content** — trips create the world; users shouldn’t need to write reviews to contribute.
3. **Habit over one-shot demo** — design for week-to-week return: recommendations and growing shared territory.
4. **Daring, not pressure** — encourage trying new places as invitation and discovery, not guilt or grind.
5. **Scope honesty** — ship a deep Pittsburgh/CMU experience before spreading thin geographically.

## Accessibility & Inclusion

No product-specific accessibility standard was set beyond building a usable web app for young adults. Treat WCAG-minded defaults (contrast, keyboard, clear errors) as baseline engineering practice; tighten if users with specific needs are identified later.
