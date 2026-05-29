# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

```
getFit/
  movr/          ← movement break timer app (Movr)
  core_circuit.md
  CLAUDE.md
  README.md
```

## Movr — Running the App

```bash
cd movr
pip install -r requirements.txt
python app.py
# Open http://localhost:5050
```

No build step, no test suite, no linter configured.

## Movr — Architecture

Two independent state machines that communicate via REST:

**Server (movr/app.py) — exercise rotation state**
- Flask session holds the day's exercise order (shuffled on first visit or day rollover), `current_index`, `repeat_count` (0–2), and `completed_breaks` log
- Each exercise shows for 3 consecutive breaks (`repeat_count >= 3` advances `current_index`)
- Exercises wrap infinitely; the shuffled `exercise_order` is an index list into `exercises.json`
- Basic mode routes: `GET /api/state`, `POST /api/complete_break`, `POST /api/skip_exercise`, `GET /api/history`
- Advanced mode routes: `GET /api/advanced/state`, `POST /api/advanced/complete`

**Advanced mode (movr/app.py) — circuit rotation state**
- Separate `adv_state` session key holds independent upper/lower/core indices and pass counters
- First pass through each category is sequential (posture-focused exercises first); subsequent passes are shuffled
- `POST /api/advanced/complete` advances all three indices and logs the completed circuit

**Client (movr/static/timer.js) — countdown state**
- Runs entirely in the browser; phase is `"rest"` (30 min) or `"break"` (5 min basic / 7 min advanced)
- Timer auto-starts in `"rest"` on page load; a page refresh resets the countdown but not the exercise rotation (that lives in the Flask session)
- Mode (basic/advanced) is persisted in `localStorage`; switching mid-break immediately starts the new mode's exercise timer
- `completeBreak()` doubles as "start break now" (when `phase !== "break"`) and "mark done" (when `phase === "break"`)
- Auto-ends break silently if the break timer expires without user action (no server call)

**Advanced circuit timer**
- Each break runs 3 sets × 3 exercises = 9 steps; each step gets its own 45-second countdown
- Bilateral exercises have a `bilateral: true` flag in JSON; the circuit timer fires a two-pulse side-switch chime at the halfway point
- Circuit auto-completes after all 9 steps; server is only called when the user clicks Done

**Data**
- `movr/exercises.json` — 15 exercises with `id`, `name`, `category` (stretch/strength/cardio/wellness), `description`, `duration_note`, `duration_seconds`, `icon`
- `movr/exercises_advanced.json` — 90 exercises split into `upper` (30), `lower` (30), `core` (30) arrays; each entry has `id`, `name`, `category`, `description`, `duration_seconds`, `icon`, and optional `bilateral: true`
- Adding exercises: append to the relevant JSON file; the rotation logic handles any list length automatically
