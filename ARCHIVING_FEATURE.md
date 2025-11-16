# Repository Archiving Feature

## Overview

This feature allows users to archive repositories, hiding them from the "Your Repositories" sidebar while keeping them accessible in Settings. Archived repositories are treated as read-only in the UI.

## Implementation Details

### Backend Changes

#### 1. Repository Layer (`roadmap_repository.py`)

Added three new methods to `UserSyncedRepoStore`:

- **`archive(user_id, full_name)`**: Sets `is_archived=True` for a user's repository
- **`unarchive(user_id, full_name)`**: Sets `is_archived=False` for a user's repository
- **`list_archived(user_id)`**: Returns all archived repositories for a user

All methods use the existing `_with_table_guard` pattern for safe database operations.

#### 2. Service Layer (`roadmap_service.py`)

Added three new methods to `RoadmapService`:

- **`archive_repo(owner, repo, user_id)`**: Archives a repository, validates it exists, and returns updated state
- **`unarchive_repo(owner, repo, user_id)`**: Unarchives a repository, validates it's archived, and returns updated state
- **`list_archived_repos(user_id)`**: Returns list of archived repositories for a user

All methods include proper error handling with HTTP exceptions for missing repositories.

#### 3. API Endpoints (`roadmap.py`)

Added three new authenticated endpoints:

- **`POST /api/v1/roadmap/archive/{owner}/{repo}`**: Archive a repository
- **`POST /api/v1/roadmap/unarchive/{owner}/{repo}`**: Unarchive a repository
- **`GET /api/v1/roadmap/archived`**: List archived repositories for current user

All endpoints require `require_clerk_auth` authentication.

### Frontend Changes

#### 1. Service Layer (`repos.ts`)

Added three new methods to `repoService`:

- **`archiveRepo(owner, repo, authToken)`**: Calls archive endpoint
- **`unarchiveRepo(owner, repo, authToken)`**: Calls unarchive endpoint
- **`listArchivedRepos(authToken)`**: Calls list archived endpoint

All methods follow the existing API client pattern with proper error handling.

#### 2. Context Provider (`roadmap-catalog-provider.tsx`)

Extended `RoadmapCatalogProvider` with:

- **`archivedRepos` state**: Stores list of archived repositories
- **`refreshArchivedRepos()` function**: Fetches archived repos from API
- **`archive(fullName)` function**: Archives a repo and updates local state
- **`unarchive(fullName)` function**: Unarchives a repo and updates local state

The provider automatically loads archived repos when the user is signed in.

#### 3. Settings UI (`account-settings-dialog.tsx`)

Added new "Archived Repositories" page to the settings dialog:

- Displays list of archived repositories with descriptions
- Shows empty state when no archived repos exist
- Provides "Unarchive" button for each archived repo
- Includes loading states during unarchive operations
- Shows read-only indicator for archived repos

#### 4. Sidebar (`sidebar.tsx`)

The sidebar already filters out archived repos using:

```typescript
const userReposToRender = useMemo(
  () => yourRepos.filter((repo) => !repo.is_archived),
  [yourRepos]
);
```

No changes were needed here.

## Database Schema

The `is_archived` field already exists in the `UserSyncedRepo` model:

```python
is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
```

This was added in a previous migration (`20241116_upgrade_roadmaps_and_user_repo_state.py`).

## User Flow

1. **Archiving a Repository**:
   - User can archive a repo (implementation depends on where archive action is triggered)
   - Repo disappears from "Your Repositories" sidebar
   - Repo appears in Settings > Archived Repositories

2. **Viewing Archived Repositories**:
   - User opens Settings dialog
   - Navigates to "Archived Repositories" tab
   - Sees list of all archived repos with descriptions

3. **Unarchiving a Repository**:
   - User clicks "Unarchive" button in Settings
   - Repo is unarchived via API
   - Repo reappears in "Your Repositories" sidebar
   - Repo is removed from archived list

## Security Considerations

- All archive/unarchive operations require authentication via Clerk
- Users can only archive/unarchive their own repositories
- Backend validates repository ownership before allowing operations

## Future Enhancements

- Add archive action to repository cards/context menus
- Add bulk archive/unarchive operations
- Add archive date tracking
- Add search/filter for archived repositories

## Testing Notes

- Test archiving a synced repository
- Test unarchiving an archived repository
- Test listing archived repositories
- Test that archived repos don't appear in sidebar
- Test that archived repos appear in settings
- Test error handling for non-existent repositories
- Test authentication requirements

