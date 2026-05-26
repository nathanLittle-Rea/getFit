# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
pip install -r requirements.txt
python app.py
# Open http://localhost:5050
```

No build step, no test suite, no linter configured.

## Architecture

Two independent state machines that communicate via REST:

**Server (app.py) — exercise rotation state**
- Flask session holds the day's exercise order (shuffled on first visit or day rollover), `current_index`, `repeat_count` (0–2), and `completed_breaks` log
- Each exercise shows for 3 consecutive breaks (`repeat_count >= 3` advances `current_index`)
- Exercises wrap infinitely; the shuffled `exercise_order` is an index list into `exercises.json`
- Routes: `GET /api/state`, `POST /api/complete_break`, `POST /api/skip_exercise`, `GET /api/history`

**Client (static/timer.js) — countdown state**
- Runs entirely in the browser; phase is `"rest"` (30 min) or `"break"` (5 min)
- Timer state is local JS variables — a page refresh resets the countdown but not the exercise rotation (that lives in the Flask session)
- `completeBreak()` doubles as "start break now" (when `phase === "rest"`) and "mark done" (when `phase === "break"`)
- Auto-ends break silently if the 5-minute timer expires without user action (no server call)

**Data**
- `exercises.json` — 15 exercises with `id`, `name`, `category` (stretch/strength/cardio/wellness), `description`, `duration_note`, `icon`
- Adding exercises: append to `exercises.json`; the rotation logic handles any list length automatically
