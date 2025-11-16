# Metadata Collection During Roadmap Generation

## Overview

This feature adds comprehensive metadata collection during roadmap generation, including repository languages, topics, statistics, and AI-powered difficulty classification.

## Implementation Date

November 16, 2025

## Changes Summary

### Backend Changes

#### 1. RepositoryMetadata Model (`app/services/github.py`)

Extended the `RepositoryMetadata` dataclass to include:
- `languages: Optional[dict[str, int]]` - All languages with byte counts
- `topics: Optional[List[str]]` - GitHub repository topics/tags
- `fork_count: int` - Number of forks
- `last_pushed_at: Optional[datetime]` - Last push timestamp
- `license: Optional[str]` - Repository license name
- `contributor_count: int` - Number of contributors

#### 2. GitHub Service (`app/services/github.py`)

**New Methods:**
- `_fetch_languages(identity)` - Fetches repository languages from GitHub API
- `_fetch_topics(identity)` - Fetches repository topics from GitHub API
- `_fetch_contributor_count(identity)` - Fetches and counts contributors with pagination support

**Updated Methods:**
- `fetch_repository(identity)` - Now fetches all metadata in parallel using `asyncio.gather()`
  - Parses `last_pushed_at` from ISO format
  - Extracts license name from license object
  - Handles errors gracefully (returns None/0 for missing data)

#### 3. Difficulty Classification (`app/services/ai/gemini.py`)

**New Method:**
- `classify_difficulty(repo, chunks)` - Uses Gemini AI to classify repository difficulty
  - Returns one of: "intro", "easy", "medium", "hard"
  - Analyzes repository metadata, commit history, and complexity
  - Defaults to "medium" on errors or invalid responses
  - Validates and normalizes AI responses

#### 4. Roadmap Service (`app/services/roadmap_service.py`)

**Updated Methods:**
- `generate()` - Now:
  1. Fetches repository with full metadata
  2. Classifies difficulty using AI
  3. Passes difficulty to `_to_summary()`

- `_to_summary(repo, difficulty)` - Now includes:
  - `primary_language` - Primary language (from `language` or top language by bytes)
  - `languages` - Sorted list of all languages (by bytes, descending)
  - `topics` - Repository topics
  - `difficulty` - AI-classified difficulty level
  - `star_count`, `fork_count`, `contributor_count` - Statistics
  - `last_pushed_at` - Last push timestamp
  - `license` - License name

#### 5. Roadmap Repository (`app/services/roadmap_repository.py`)

**Updated Methods:**
- `upsert(response)` - Now stores all metadata fields:
  - Updates existing records with new metadata
  - Parses `last_pushed_at` from string or datetime
  - Stores all fields in `GeneratedRoadmap` model

### Database Schema

The `GeneratedRoadmap` model already had all required fields:
- `primary_language: Optional[str]`
- `languages: Optional[list]` (JSON)
- `topics: Optional[list]` (JSON)
- `difficulty: Optional[str]`
- `star_count: int`
- `fork_count: int`
- `last_pushed_at: Optional[datetime]`
- `license: Optional[str]`
- `contributor_count: int`

No migration was needed as these fields were already present.

## Testing

### New Test Files

1. **`tests/test_github_service.py`** - Tests for GitHub service metadata collection:
   - `test_fetch_repository_with_metadata` - Verifies all metadata is collected
   - `test_fetch_repository_handles_missing_metadata` - Tests graceful error handling
   - `test_fetch_contributor_count_with_pagination` - Tests pagination support
   - `test_fetch_languages` - Tests language fetching
   - `test_fetch_languages_handles_error` - Tests error handling
   - `test_fetch_topics` - Tests topic fetching
   - `test_fetch_topics_handles_error` - Tests error handling

### Updated Test Files

2. **`tests/test_roadmap.py`** - Added metadata collection tests:
   - `test_metadata_collection_in_upsert` - Verifies metadata storage
   - `test_metadata_update_on_upsert` - Tests metadata updates
   - `test_to_summary_includes_all_metadata` - Tests summary generation
   - `test_to_summary_handles_missing_metadata` - Tests missing data handling
   - `test_difficulty_classification` - Tests AI difficulty classification
   - `test_difficulty_classification_defaults_on_error` - Tests error handling
   - `test_difficulty_classification_validates_response` - Tests response validation

### Test Results

All 37 tests pass:
- 30 existing roadmap tests
- 4 new metadata collection tests
- 3 new difficulty classification tests
- 7 new GitHub service tests

## API Behavior

### Roadmap Generation Flow

1. User requests roadmap generation
2. System fetches repository metadata from GitHub (including languages, topics, stats)
3. System fetches commit history
4. System classifies difficulty using AI
5. System generates roadmap timeline
6. System stores all metadata in database
7. System returns roadmap with full metadata

### Error Handling

- **Missing Metadata**: System gracefully handles missing data (returns None/0)
- **API Errors**: GitHub API errors are caught and logged, defaults are used
- **AI Classification Errors**: Difficulty defaults to "medium" on errors
- **Invalid AI Responses**: System validates and normalizes AI responses

## Performance Considerations

- **Parallel Fetching**: Languages, topics, and contributor count are fetched in parallel using `asyncio.gather()`
- **Pagination**: Contributor count uses pagination to handle large repositories (max 1000 contributors)
- **Caching**: Metadata is stored in database and reused for cached roadmaps
- **Timeout**: Difficulty classification has a 15-second timeout

## Future Enhancements

The following are NOT implemented yet (as per requirements):
- Filters based on metadata (language, difficulty, topics)
- Search functionality using metadata
- Sorting by metadata fields

These can be added in future iterations.

## Code Quality

- All code follows FastAPI + SQLAlchemy best practices
- Type hints are used throughout
- Error handling is comprehensive
- Tests cover happy paths, error cases, and edge cases
- Code is formatted with `black` and `isort`
- Linting passes with `flake8`

## Git Information

- Branch: `feature/metadata-collection`
- Files Changed:
  - `app/services/github.py` - Metadata fetching
  - `app/services/ai/gemini.py` - Difficulty classification
  - `app/services/roadmap_service.py` - Integration
  - `app/services/roadmap_repository.py` - Storage
  - `tests/test_github_service.py` - New test file
  - `tests/test_roadmap.py` - Updated tests

