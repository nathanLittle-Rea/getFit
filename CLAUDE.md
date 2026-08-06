# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

`getFit/` is both a project (the 30/5 movement-break timer described below) and an umbrella directory for related fitness tools. Two subdirectories are **independent git repositories with their own GitHub remotes**, nested here on disk only for convenience — getFit's `.gitignore` excludes them so this repo never tracks their contents:

- `coreFit/` — Flask app for a core/upper-body interval circuit (40s work / 20s rest). Own repo. `cd coreFit && pip install -r requirements.txt && python3 app.py`, serves on http://localhost:5051.
- `stretch/morning-stretch-app/` — Python desktop stretching app. Own repo, own `CLAUDE.md` with detailed run instructions (`launch.sh`/`launch.bat`, `menubar.py`).

Treat each as its own project root — run commands from inside it, never assume changes in one affect the others, and never commit across the boundary (e.g. `git add` from `getFit/`'s repo should never pick up files inside `coreFit/` or `stretch/`).

## Commands (getFit itself)

```bash
pip install -r requirements.txt
python3 app.py     # serves on http://localhost:5050 (Windows: python app.py)
```

No test suite, linter, or build step is configured.

## Architecture

Small Flask app (`app.py`) with server-rendered HTML shell (`templates/index.html`) and a vanilla-JS state machine (`static/timer.js`) driving all timer/UI behavior client-side. No database — per-user state lives entirely in the Flask `session` cookie.

**State flow:** `app.py`'s `get_session_state()` lazily initializes (or resets, on a new calendar day) a session dict: a shuffled `exercise_order` over all exercises in `exercises.json`, `current_index`, `repeat_count`, `total_breaks`, and `completed_breaks`. Exercises repeat for 3 breaks (`repeat_count`) before `current_index` advances to the next shuffled exercise — this rotation logic lives only in `/api/complete_break`.

**API surface** (all read/mutate the session state above):
- `GET /api/state` — current exercise + progress, used on page load
- `POST /api/complete_break` — logs a completed break, increments counters, rotates exercise after 3 reps
- `POST /api/skip_exercise` — advances to next exercise immediately, resets `repeat_count`
- `GET /api/history` — today's completed breaks list

**Client timer** (`static/timer.js`): the 30-minute rest / 5-minute break countdown is a pure client-side `setInterval` loop (`phase` = `"rest"` | `"break"`); the server has no concept of elapsed time or the rest/break phase — it only tracks exercise rotation and break history. Browser Notifications fire on phase transitions if permission was granted. Reset/Pause only affect client-side timer state, not the server session.

**Exercise data** (`exercises.json`): flat array of objects (`id`, `name`, `category`, `description`, `duration_note`, `icon`). Editing this file changes the exercise pool directly — no migration needed, but note `current_index`/`exercise_order` in any live session reference array positions, so structural edits (reordering/removing) mid-day could desync an existing session until it resets the next day.

## Notes

- `app.secret_key = os.urandom(24)` regenerates on every server restart, invalidating all existing sessions (users' in-progress timers/history reset).
