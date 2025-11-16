# User Ratings Feature Implementation

## Overview
This document describes the implementation of the user ratings feature for repositories in the Commitly application. Users can rate repositories (roadmaps) from 1-5 stars, and the system maintains aggregated statistics (average rating and total count).

## Feature Requirements
- Allow authenticated users to rate repositories (1-5 stars)
- Store per-user ratings with unique constraint on (user_id, repo_full_name)
- Maintain aggregated statistics (rating_count, rating_sum) on GeneratedRoadmap
- Display user's rating and average rating on the timeline page
- All rating endpoints require authentication

## Backend Implementation

### Database Schema

#### RoadmapRating Model
- **Table**: `roadmap_ratings`
- **Fields**:
  - `id` (PK): Integer primary key
  - `user_id`: String(255), indexed, not null
  - `repo_full_name`: String(255), indexed, not null
  - `rating`: Integer (1-5), not null
  - `created_at`: DateTime with timezone, auto-set on creation
  - `updated_at`: DateTime with timezone, auto-updated on modification
- **Constraints**:
  - Unique constraint on `(user_id, repo_full_name)` to ensure one rating per user per repo

#### GeneratedRoadmap Updates
- Added `rating_count`: Integer, nullable (total number of ratings)
- Added `rating_sum`: Integer, nullable (sum of all ratings)
- Average rating is calculated as `rating_sum / rating_count`

### Migration
- **File**: `alembic/versions/20241116_add_roadmap_ratings_table.py`
- Creates the `roadmap_ratings` table with all required fields and constraints
- Includes indexes on `user_id` and `repo_full_name` for query performance

### Service Layer

#### RoadmapRatingStore
- **File**: `app/services/roadmap_rating_store.py`
- **Methods**:
  - `upsert_rating(user_id, repo_full_name, rating)`: Creates or updates a user's rating
    - Validates rating is between 1-5
    - Updates aggregated stats on GeneratedRoadmap
    - Handles both new ratings (increment count, add to sum) and updates (adjust sum only)
  - `get_user_rating(user_id, repo_full_name)`: Retrieves a user's rating for a repository
- **Features**:
  - Automatic table creation if missing (for development/testing)
  - Handles database errors gracefully
  - Updates both rating_count and rating_sum atomically

#### RoadmapService Integration
- **File**: `app/services/roadmap_service.py`
- **Methods**:
  - `set_rating(user_id, owner, repo, rating)`: Sets or updates a user's rating
    - Returns `RatingResponse` with rating details
    - Raises HTTPException if rating service is unavailable
  - `get_user_rating(user_id, owner, repo)`: Gets a user's rating
    - Returns `RatingResponse` or `None` if no rating exists
- **Integration**:
  - `RoadmapRatingStore` is instantiated in `build_roadmap_service()` and passed to `RoadmapService`

### API Endpoints

#### POST /api/v1/roadmap/{owner}/{repo}/rating
- **Purpose**: Create or update a user's rating for a repository
- **Authentication**: Required (Clerk)
- **Request Body**:
  ```json
  {
    "rating": 5
  }
  ```
- **Response**: `RatingResponse`
  ```json
  {
    "rating": 5,
    "repo_full_name": "owner/repo",
    "user_id": "user_123",
    "created_at": "2024-11-16T10:00:00Z",
    "updated_at": "2024-11-16T10:00:00Z"
  }
  ```
- **Validation**: Rating must be between 1-5 (enforced by Pydantic schema)

#### GET /api/v1/roadmap/{owner}/{repo}/rating
- **Purpose**: Get the current user's rating for a repository
- **Authentication**: Required (Clerk)
- **Response**: `RatingResponse` or `null` if no rating exists
- **Status Code**: 200 (even if no rating exists)

### Models and Schemas

#### RoadmapRating (SQLAlchemy Model)
- Located in `app/models/roadmap.py`
- Represents the database table structure

#### RatingRequest (Pydantic Schema)
- **Fields**:
  - `rating`: int, constrained to 1-5
- Used for POST request validation

#### RatingResponse (Pydantic Schema)
- **Fields**:
  - `rating`: int
  - `repo_full_name`: str
  - `user_id`: str
  - `created_at`: datetime
  - `updated_at`: datetime
- Used for API responses

## Frontend Implementation

### API Service
- **File**: `lib/services/repos.ts`
- **Methods**:
  - `setRating(owner, repo, rating, authToken)`: Calls POST rating endpoint
  - `getUserRating(owner, repo, authToken)`: Calls GET rating endpoint
- **Routes**:
  - `API_ROUTES.rating(owner, repo)`: Returns `/api/v1/roadmap/${owner}/${repo}/rating`

### StarRating Component
- **File**: `components/ui/star-rating.tsx`
- **Props**:
  - `value`: number (0-5, can be fractional for averages)
  - `onValueChange?`: (value: number) => void
  - `readonly?`: boolean
  - `size?`: "sm" | "md" | "lg"
  - `showValue?`: boolean
  - `className?`: string
- **Features**:
  - Interactive stars for user input
  - Read-only mode for displaying averages
  - Supports fractional values for average ratings
  - Visual feedback on hover (when not readonly)

### Timeline Page Integration
- **File**: `app/repo/[repoId]/timeline/page.tsx`
- **Features**:
  - Fetches user's rating on page load (if authenticated)
  - Displays user's rating with interactive stars (for synced repos)
  - Displays average rating and total count
  - Handles rating updates and refreshes roadmap data
- **State Management**:
  - `userRating`: Current user's rating (null if not rated)
  - `isRatingLoading`: Loading state for rating operations
  - `averageRating`: Computed from `rating_sum / rating_count`

## Testing

### Backend Tests
- **File**: `tests/test_roadmap.py`
- **Test Cases**:
  1. `test_set_rating_endpoint`: Verifies setting a new rating and initial aggregation
  2. `test_set_rating_endpoint_requires_auth`: Ensures authentication is required
  3. `test_update_rating_endpoint`: Verifies updating an existing rating and correct aggregation
  4. `test_get_rating_endpoint`: Verifies retrieving a user's rating
  5. `test_get_rating_endpoint_requires_auth`: Ensures authentication is required
  6. `test_get_rating_nonexistent`: Checks handling when no rating exists
  7. `test_set_rating_invalid_range`: Verifies validation for ratings outside 1-5
  8. `test_rating_aggregation_multiple_users`: Tests aggregation with multiple users

### Test Coverage
- Rating creation and updates
- Aggregation logic (count and sum)
- Authentication requirements
- Validation (rating range)
- Edge cases (no rating, multiple users)

## Database Migration

### Running the Migration
```bash
cd commitly-backend
alembic upgrade head
```

### Rolling Back
```bash
alembic downgrade -1
```

## Security Considerations
- All rating endpoints require Clerk authentication
- Users can only view/modify their own ratings
- Rating values are validated (1-5 range)
- Unique constraint prevents duplicate ratings per user/repo

## Performance Considerations
- Indexes on `user_id` and `repo_full_name` for fast lookups
- Aggregated stats (count/sum) stored on GeneratedRoadmap to avoid expensive calculations
- Atomic updates ensure data consistency

## Future Enhancements (Not Implemented)
- Rating deletion (users can update to change rating)
- Rating history/audit trail
- Rating filters/search
- Social features (comments, feeds, leaderboards) - explicitly excluded per requirements

## Files Changed

### Backend
- `app/models/roadmap.py`: Added RoadmapRating model and schemas
- `app/services/roadmap_rating_store.py`: New service for rating operations
- `app/services/roadmap_service.py`: Integrated rating methods
- `app/api/roadmap.py`: Added rating endpoints
- `alembic/versions/20241116_add_roadmap_ratings_table.py`: Migration file
- `tests/test_roadmap.py`: Added comprehensive tests

### Frontend
- `lib/services/repos.ts`: Added rating API methods
- `components/ui/star-rating.tsx`: New reusable component
- `app/repo/[repoId]/timeline/page.tsx`: Integrated rating UI

## Notes
- The feature is designed to be non-social (no feeds, comments, or public leaderboards)
- Ratings are per-user and private (users see their own rating and aggregated stats)
- The implementation follows existing code patterns and conventions
- All code passes linting (flake8, black, isort) and tests

