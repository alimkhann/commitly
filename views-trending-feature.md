# Views & Basic Trending Sort Feature Implementation

## Overview
This feature implements view tracking and trending sort functionality for roadmaps, allowing users to see which repositories are most popular without introducing social features.

## Implementation Date
**Started:** November 16, 2025
**Status:** ✅ Complete

---

## Backend Implementation Status

✅ Database Migration (`20241116_add_roadmap_view_tracker.py`)
- Created `roadmap_view_tracker` table
- Added indexes for performance

✅ Model (`app/models/roadmap.py`)
- Added `RoadmapViewTracker` model

✅ View Tracking Service (`app/services/roadmap_view_tracker.py`)
- Implements 24-hour cooldown per user
- Handles anonymous views
- UPSERT logic for race condition safety

✅ Repository Updates (`app/services/roadmap_repository.py`)
- Added `increment_view_count()` method
- Updated `list_paginated()` with sorting support
  - Sort options: newest, most_viewed, most_synced, highest_rated, trending
  - Trending formula implemented

✅ Service Updates (`app/services/roadmap_service.py`)
- Added `record_roadmap_view()` method
- Updated `list_catalog()` to accept sort parameter
- Integrated view tracker in dependency injection

✅ API Endpoints (`app/api/roadmap.py`)
- Updated `/catalog` endpoint with sort parameter
- Added `/{owner}/{repo}/view` endpoint (optional auth)
- Added `optional_clerk_auth()` helper in `app/core/auth.py`

---

## Frontend Implementation Status

✅ Service Updates (`lib/services/repos.ts`)
- Added `sort` parameter to `listCatalog()` method
- Added `recordRoadmapView()` method
- Updated API routes with `recordView` endpoint

✅ Search Page (`app/search/page.tsx`)
- Added sort dropdown with 5 options: newest, trending, most_viewed, most_synced, highest_rated
- Updated catalog fetch to use sort parameter
- Added view and sync count display in repo cards using Eye and Users icons

✅ Timeline Page (`app/repo/[repoId]/timeline/page.tsx`)
- Added useEffect hook to record view when timeline loads
- View recorded for both authenticated and anonymous users

---

## Requirements

### Backend
1. **View Tracking**
   - Increment `view_count` on `GeneratedRoadmap` each time a roadmap timeline is viewed
   - Implement anti-spam strategy (only once per user per time window)

2. **Sort Options**
   - Extend catalog endpoint to accept sort parameter
   - Support: `most_viewed`, `highest_rated`, `newest`, `most_synced`, `trending`
   - Trending formula: combines `view_count`, `sync_count`, and average rating

### Frontend
1. **Sort Dropdown**
   - Add sort selector on Search page
   - Persist sort selection in UI state

2. **Display Metrics**
   - Show view count in repo cards
   - Show sync count in repo cards
   - No separate trending feed page

---

## Database Schema

### Existing Fields in `GeneratedRoadmap`
- `view_count: int` (default 0) - Already exists
- `sync_count: int` (default 0) - Already exists
- `rating_count: int` (default 0) - Already exists
- `rating_sum: int` (default 0) - Already exists
- `updated_at: datetime` - For newest sort

**No migration needed** - all required fields already exist.

---

## Backend Implementation

### 1. View Tracking Service

#### New Table: `roadmap_view_tracker`
```sql
CREATE TABLE roadmap_view_tracker (
    id SERIAL PRIMARY KEY,
    repo_full_name VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(repo_full_name, user_id)
);
CREATE INDEX idx_roadmap_view_tracker_viewed_at ON roadmap_view_tracker(viewed_at);
```

**Purpose:** Track views per user to prevent spam (only increment once per user per time window)

#### Service: `RoadmapViewTracker`
**Location:** `app/services/roadmap_view_tracker.py`

**Methods:**
- `can_increment_view(repo_full_name: str, user_id: str | None) -> bool`
  - Check if view can be counted (based on time window)
  - Allow anonymous views but prevent spamming
- `record_view(repo_full_name: str, user_id: str | None) -> None`
  - Record the view in tracker table
- `increment_view_if_eligible(repo_full_name: str, user_id: str | None) -> bool`
  - Combined check and increment operation

### 2. Update RoadmapResultStore

**File:** `app/services/roadmap_repository.py`

**New Method:**
```python
def increment_view_count(self, full_name: str) -> None:
    """Increment the view count for a roadmap."""
```

### 3. Sorting Logic in RoadmapResultStore

**File:** `app/services/roadmap_repository.py`

**Updated Method:**
```python
def list_paginated(
    self,
    page: int,
    page_size: int,
    sort: str = "newest"
) -> tuple[list[RoadmapResponse], int]:
    """
    Sort options:
    - newest: Order by updated_at DESC (default)
    - most_viewed: Order by view_count DESC
    - most_synced: Order by sync_count DESC
    - highest_rated: Order by (rating_sum / rating_count) DESC
    - trending: Order by trending_score DESC

    Trending score = (view_count * 0.4) + (sync_count * 0.3) + (avg_rating * 6 * 0.3)
    """
```

### 4. Update RoadmapService

**File:** `app/services/roadmap_service.py`

**Updated Method:**
```python
async def list_catalog(
    self,
    page: int,
    page_size: int,
    sort: str = "newest"
) -> RoadmapCatalogPage:
```

**New Method:**
```python
async def record_roadmap_view(
    self,
    repo_full_name: str,
    user_id: str | None
) -> None:
    """Record a roadmap view and increment counter if eligible."""
```

### 5. Update API Endpoint

**File:** `app/api/roadmap.py`

**Updated Endpoint:**
```python
@router.get("/catalog", response_model=RoadmapCatalogPage)
async def list_roadmaps(
    page: int = 1,
    page_size: int = 20,
    sort: str = "newest",
    service: RoadmapService = Depends(get_roadmap_service),
) -> RoadmapCatalogPage:
    return await service.list_catalog(page, page_size, sort)
```

**New Endpoint:**
```python
@router.post("/{owner}/{repo}/view", status_code=status.HTTP_204_NO_CONTENT)
async def record_roadmap_view(
    owner: str,
    repo: str,
    current_user: ClerkClaims | None = Depends(optional_clerk_auth),
    service: RoadmapService = Depends(get_roadmap_service),
) -> Response:
    """Record a view of a roadmap timeline. Auth is optional."""
    user_id = current_user["sub"] if current_user else None
    await service.record_roadmap_view(f"{owner}/{repo}", user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

### 6. Migration

**File:** `alembic/versions/20241116_add_roadmap_view_tracker.py`

---

## Frontend Implementation

### 1. API Service Updates

**File:** `lib/services/repos.ts`

**New Route:**
```typescript
const API_ROUTES = {
  // ... existing routes
  recordView: (owner: string, repo: string) =>
    `/api/v1/roadmap/${owner}/${repo}/view`,
};
```

**New Method:**
```typescript
async recordRoadmapView(
  owner: string,
  repo: string,
  authToken?: string
): Promise<ApiClientResponse<void>> {
  if (!env.apiBaseUrl) {
    return { ok: false, status: 0, error: "API base URL missing" };
  }
  return apiClient<void>(env.apiBaseUrl, {
    path: API_ROUTES.recordView(owner, repo),
    method: "POST",
    authToken,
  });
}
```

**Updated Method:**
```typescript
async listCatalog(
  page = 1,
  pageSize = 50,
  sort = "newest"
): Promise<ApiClientResponse<RoadmapCatalogPage>> {
  if (!env.apiBaseUrl) {
    return { ok: false, status: 0, error: "API base URL missing" };
  }
  return apiClient<RoadmapCatalogPage>(env.apiBaseUrl, {
    path: `${API_ROUTES.catalog}?page=${page}&page_size=${pageSize}&sort=${sort}`,
    cache: "no-store",
  });
}
```

### 2. Timeline Page - Record View

**File:** `app/repo/[repoId]/timeline/page.tsx`

**Add Effect:**
```typescript
useEffect(() => {
  // Record view when timeline is loaded
  if (identity && isRoadmapReady) {
    const recordView = async () => {
      const token = await getToken?.();
      await repoService.recordRoadmapView(
        identity.owner,
        identity.repoName,
        token ?? undefined
      );
    };
    recordView();
  }
}, [identity, isRoadmapReady, getToken]);
```

### 3. Search Page - Sort Dropdown

**File:** `app/search/page.tsx`

**Add State:**
```typescript
const [sortBy, setSortBy] = useState<
  "newest" | "most_viewed" | "most_synced" | "highest_rated" | "trending"
>("newest");
```

**Update Fetch Logic:**
```typescript
useEffect(() => {
  // ... existing logic
  const response = await repoService.listCatalog(1, 50, sortBy);
  // ...
}, [backendConfigured, sortBy]);
```

**Add Sort Dropdown UI:**
```tsx
<div className="flex items-center gap-2">
  <Select value={sortBy} onValueChange={setSortBy}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="Sort by" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="newest">🆕 Newest</SelectItem>
      <SelectItem value="trending">🔥 Trending</SelectItem>
      <SelectItem value="most_viewed">👁️ Most Viewed</SelectItem>
      <SelectItem value="most_synced">⭐ Most Synced</SelectItem>
      <SelectItem value="highest_rated">⭐ Highest Rated</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### 4. Repo Card - Display Metrics

**Update Repo Card Component to show:**
- View count with eye icon
- Sync count with star/bookmark icon

---

## Testing

### Backend Tests
**File:** `tests/test_roadmap_views.py`

1. `test_view_tracker_prevents_duplicate_views()`
2. `test_view_tracker_allows_after_time_window()`
3. `test_anonymous_view_tracking()`
4. `test_catalog_sort_most_viewed()`
5. `test_catalog_sort_most_synced()`
6. `test_catalog_sort_highest_rated()`
7. `test_catalog_sort_trending()`
8. `test_trending_score_calculation()`

### Frontend Tests
- Manual testing of sort dropdown
- View tracking on timeline page load
- Metrics display in repo cards

---

## Anti-Spam Strategy

**Time Window:** 24 hours
- A user can only increment view_count once per 24 hours
- Tracked via `roadmap_view_tracker` table
- Anonymous users tracked by IP (future enhancement)
- Current: No IP tracking, just relies on user_id if authenticated

**Alternative Simple Strategy:**
- Use UPSERT with ON CONFLICT to prevent duplicate counting
- Update `viewed_at` timestamp on each view
- Only count view if last `viewed_at` is > 24 hours ago

---

## Trending Score Formula

```
trending_score = (view_count * 0.4) + (sync_count * 0.3) + (avg_rating * 6 * 0.3)
```

**Rationale:**
- View count (40%): Indicates general interest
- Sync count (30%): Indicates commitment/value
- Average rating (30%): Indicates quality (multiplied by 6 to scale 1-5 to 6-30)

**Note:** This formula is simple and can be refined based on data analysis.

---

## Code Quality

- ✅ Follow FastAPI + SQLAlchemy best practices
- ✅ Use Alembic for database migration
- ✅ Type hints on all functions
- ✅ Proper error handling
- ✅ Security: Optional auth for view tracking
- ✅ No social features (no comments, feeds, follows)

---

## Security Considerations

1. **View Endpoint:**
   - Optional authentication (works for both logged-in and anonymous users)
   - Rate limiting recommended (future)

2. **Sort Parameter:**
   - Validated enum to prevent SQL injection
   - Safe default value

3. **Anti-Spam:**
   - Time-based deduplication
   - Per-user tracking

---

## Future Enhancements

- IP-based tracking for anonymous users
- More sophisticated trending algorithm (time decay, recency bonus)
- View analytics dashboard (admin only)
- Popular repositories widget on homepage

---

## Git Information

- **Branch:** `feature/views-trending-sort`
- **Base Branch:** `feature/user-ratings`
- **Repository:** alimkhann/commitly
