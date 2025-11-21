# Teaching Roadmap Implementation Log

## Goal
Evolve the roadmap feature into a teaching-oriented learning path for beginners.

## Plan
1.  **Backend Updates**
    *   [x] Update `TimelineStage` model in `app/models/roadmap.py` (added `prerequisites`, `checkpoints`).
    *   [x] Update `GeminiRoadmapGenerator` in `app/services/ai/gemini.py`.
        *   [x] Implement multi-step pipeline (Plan -> Expand).
        *   [x] Implement time-based commit clustering.
        *   [x] Update prompts for teaching focus.
    *   [ ] Linting & Formatting.

2.  **Frontend Updates**
    *   [ ] Update types in `commitly-frontend`.
    *   [ ] Update UI components to render goals, structured tasks, code examples, etc.

## Progress
- [x] Backend models updated.
- [x] Gemini service refactored with multi-step pipeline.
- [ ] Linting checks.
