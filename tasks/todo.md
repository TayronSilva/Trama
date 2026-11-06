# Trama TODO — Sprint 2

## Foundation

- [x] 1. Back up `data/trama.db` before schema work
- [x] 2. Add failing tests for update, delete, duplicate, tags, limits and migration
- [x] 3. Add `tags` column, channel limits and migration helper to `lib/store.js`
- [x] 4. Split legacy multi-channel rows into one row per channel; keep migration idempotent
- [x] 5. Make `createIdeas` fan out one row per channel; keep `createIdea` single-channel

## CRUD and actions

- [x] 6. Implement `updateIdea`, `deleteIdea` and `duplicateIdea`
- [x] 7. Add `updateIdeaAction`, `deleteIdeaAction` and `duplicateIdeaAction`
- [x] 8. Keep schedule/publish independent per row

## Tags and limits

- [x] 9. Normalize tags (trim, no empty, no duplicates)
- [x] 10. Add tags field and live chips to Create
- [x] 11. Add tag filters to library and queue with a clear-filter link
- [x] 12. Add channel `limit` and preview label to `lib/channels.js`
- [x] 13. Add live character counter and per-channel preview cards
- [x] 14. Block schedule/publish when text exceeds the channel limit

## UI

- [x] 15. Inline editor in library and queue, without changing an existing schedule
- [x] 16. Two-step delete confirmation without modal
- [x] 17. Duplicate action in library and queue
- [x] 18. Show each channel as its own row in queue and calendar
- [x] 19. Responsive polish at 390px and WCAG AA contrast check

## Validation

- [x] 20. `npm test` green
- [x] 21. `npm run build` green
- [x] 22. Playwright: create 2 channels, edit, duplicate, filter, delete, publish, calendar, limits
- [x] 23. Console: 0 errors, 0 warnings, 0 failed requests
- [x] 24. New desktop and mobile screenshots

## Postponed

- [ ] Item 6 — AI provider, prompt builders and adaptation actions (postponed by request)
