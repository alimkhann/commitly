# Prompt 1 — Core Data Model Upgrades (GeneratedRoadmap + User Repo State)

Date: 2025-11-16

## Changes made
- Extended `generated_roadmaps` table/model with richer metadata columns:
  - `primary_language`, `languages`, `topics`, `difficulty`, `star_count`, `fork_count`, `last_pushed_at`, `license`, `contributor_count`, `view_count`, `sync_count`, `rating_count`, `rating_sum`.
- Extended per-user repo state (`user_synced_repos` table/model) with lifecycle and progress fields:
  - `status`, `is_archived`, `progress_percent`, timestamps `created_at`, `updated_at` (kept `pinned_at`).
- Updated Pydantic `RoadmapRepoSummary` to accept the new metadata fields (all optional to stay backward compatible). Existing API shapes are unchanged.

## Prompt 2 additions (Your Repositories + statuses)
- Added `UserRepoStateResponse` schema and backend endpoint `GET /api/v1/roadmap/user-repos` (auth) to return per-user repo states with status, archive flag, progress, and basic roadmap summary.
- Enhanced `UserSyncedRepoStore` with `upsert_state` and `list_states` to manage statusful per-user repos.
- Frontend `repoService` now has `listUserRepos`; `RoadmapCatalogProvider` fetches/stores `yourRepos` with Clerk auth token.
- Sidebar section renamed to “Your repositories”; now shows status badges and includes unsynced entries (non-archived), falling back to old synced list if no user data.
- Search page “Your repositories” section uses the new user-repo list and keeps stage counts via cached synced map.

## Migrations
- Added Alembic revision `20241116_upgrade_roadmaps_and_user_repo_state.py` (down_revision `20241115_add_user_synced_repos`).
- New columns have safe defaults (`0`, `false`, or nullable) to allow migration on existing data.

## Notes / Next steps
- No API or UI wiring yet; data can be populated later when GitHub fetch/sync logic is updated.
- `progress_percent` currently unused; kept within 0–100 expectation but not enforced yet (could add a CHECK later if needed).

## How to apply
```bash
cd commitly-backend
alembic upgrade head
```
