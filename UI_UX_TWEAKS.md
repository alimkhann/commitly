# UI/UX Tweaks for Timeline

## Overview
Implemented UI/UX improvements for the roadmap timeline view to enhance readability, visual hierarchy, and user guidance.

## Changes

### 1. Navigation & Structure
- **Sticky Navigation Pills**: Added a sticky, horizontally scrollable list of stage buttons above the timeline for quick navigation between stages.
- **Increased Spacing**: Increased the vertical gap between timeline stages (`gap-y-16`) to reduce visual clutter and separate "episodes".

### 2. Timeline Card Visual Hierarchy
- **Header**:
  - Added explicit "Stage X · Category · Difficulty" meta-line.
  - Improved title and status badge alignment.
- **Goals**:
  - Moved to the top of the content.
  - Styled with a small uppercase heading and a separator.
- **Tasks**:
  - Refactored into individual "subcards" with a clearer border and background.
  - Steps are bulleted lists within the subcard.
  - Files and commands are clearly distinguished.
- **Code Examples**:
  - Made collapsible by default to prevent long snippets from dominating the view.
  - Visible file name and language badge in the collapsed state.
- **Resources**:
  - Moved to the bottom of the content.
  - Styled as pill-shaped links.

### 3. Call to Action (CTA)
- **Dynamic Buttons**:
  - "Start this stage" for not-started stages (when signed in).
  - "Continue" for in-progress stages.
  - "Review" for completed stages.
  - "Details" for signed-out users.

## Files Modified
- `commitly-frontend/app/repo/[repoId]/timeline/page.tsx`
