# Implementation Plan: Trama

## Overview

A local social publishing workspace inspired by Buffer's Create and Publish workflows. It keeps an idea library, schedules ideas to mocked channels, exposes a publishing queue and a monthly calendar. No authentication, network integrations or extra screens.

## Architecture Decisions

- Next.js App Router with server components and server actions; no client state library.
- Local SQLite through Node's built-in `node:sqlite`; no native dependency.
- Store logic isolated in `lib/store.js` so it can be tested against temporary databases.
- One row represents one channel. The `channels` JSON column keeps a single-element array for compatibility; the Create screen fans out multi-channel choices into N rows.
- Schema migrations run automatically at store open, are idempotent and back up the local database before changing an existing schema.
- Portuguese UI. Seed data is realistic and only inserted on first run.

## Task List

### Phase 1: Foundation
- [x] Task 1: Store + pure date helpers, tests written first
- [x] Task 2: App shell, design tokens, navigation and seed content

### Checkpoint: Foundation
- [x] `npm test` passes
- [x] `npm run build` succeeds

### Phase 2: Core flow
- [x] Task 3: Create screen (idea capture, library, inline scheduling)
- [x] Task 4: Publish queue (grouped list, publish/unschedule actions)
- [x] Task 5: Calendar (month grid, navigation, scheduled items)

### Checkpoint: Core flow
- [x] Create -> schedule -> calendar works end to end
- [x] All routes answer 200
- [x] Console is clean

### Phase 3: Validation
- [x] Task 6: Playwright flow, desktop + mobile screenshots, console/network review
- [x] Task 7: Fix visual or runtime issues found

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `node:sqlite` unavailable in Next server runtime | High | Verified on Node 26; keep store import server-only and build early |
| Server action redirects lose validation feedback | Medium | Redirect back with a readable `erro` search param |
| Calendar timezone drift | Medium | Store and compare local `YYYY-MM-DDTHH:mm` strings |
| Font download at build | Low | Next/font fetches at build; verified Google Fonts reachable |

## Sprint 2: Modelo por canal, CRUD e limites

### Objective

Fix the core data model (one row per channel), add the basic editing actions, tags, duplication, channel previews and character limits. AI is postponed by request.

### Sprint 2 Tasks

- [x] Task 8: Store — update/delete/duplicate, tag normalization and channel limits, with tests
- [x] Task 9: Schema — add `tags`, migrate legacy multi-channel rows into one row per channel, automatic backup, tests
- [x] Task 10: Actions — update, delete, duplicate, fan-out create, tag filter params and store limits
- [x] Task 11: Create — tag field with live chips, live character counter and per-channel previews, one record per selected channel
- [x] Task 12: Library + queue — inline edit, two-step delete, duplicate, tag filter and one row per channel
- [x] Task 13: Calendar — render each channel record separately
- [x] Task 14: Validation — npm test, build, Playwright full flow, 390px, console and screenshots
- [ ] Postponed: Item 6 (AI provider, prompts and adaptation actions) — not built in this sprint

### Checkpoints

- [x] Store tests cover update, delete, duplicate, migration, tags and limits
- [x] Existing database migrated with a backup and no record loss
- [x] Create with 3 channels produces 3 independent rows
- [x] `npm test` and `npm run build` pass
- [x] Playwright flow passes with 0 console errors and no horizontal overflow at 390px

## Open Questions

None for Sprint 2. AI is postponed. Community, Insights, Collaborate, Start Page and AI Assistant remain out of scope.

## Sprint 2 Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Legacy multi-channel migration duplicates rows on every open | High | Migration detects rows with more than one channel and is idempotent |
| Migration runs before a backup | High | Detect needed migration first and create `data/backup-<timestamp>.db` before the schema/data change |
| Character limit divergence between UI and store | Medium | Share `countCharacters` and channel `limit` from `lib/channels.js` |
