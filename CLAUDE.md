# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

`getFit/` is both a project (the Movr movement-break timer) and an umbrella directory for related fitness tools. Several subdirectories are **independent git repositories with their own GitHub remotes**, nested here on disk only for convenience — getFit's `.gitignore` excludes them so this repo never tracks their contents:

- `coreFit/` — separate Flask app for an on-demand core/upper-body interval circuit (40s work / 20s rest). Own repo. `cd coreFit && pip install -r requirements.txt && python3 app.py`, serves on http://localhost:5051. Conceptually overlaps with Movr's Advanced mode (both cover core work) but is intentionally a distinct app with a different session model — not a duplicate to be merged away.
- `stretch/morning-stretch-app/` — Python desktop stretching app. Own repo, own `CLAUDE.md` with detailed run instructions (`launch.sh`/`launch.bat`, `menubar.py`).

Treat each as its own project root — run commands from inside it, never assume changes in one affect the others, and never commit across the boundary (e.g. `git add` from `getFit/`'s repo should never pick up files inside `coreFit/` or `stretch/`).

## Structure

```
getFit/
  movr/          ← movement break timer app (Movr)
  core/
    core_circuit.md
  coreFit/       ← separate app, own git repo (see above)
  stretch/       ← separate app, own git repo (see above)
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

## Notes

- Movr's `app.secret_key = os.urandom(24)` regenerates on every server restart, invalidating all existing sessions (users' in-progress timers/history reset).
