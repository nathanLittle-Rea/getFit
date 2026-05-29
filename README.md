# getFit

A lightweight Flask web app that keeps you moving throughout the day. Every 30 minutes it prompts a 5-minute movement break with a suggested exercise. Each exercise repeats for 3 consecutive breaks before rotating to the next one.

## Features

- **30/5 timer cycle** — 30-minute rest countdown, then a 5-minute active break
- **Two modes** — Basic (single exercise per break) and Advanced (7-min guided circuit: upper + lower + core × 3 sets)
- **Exercise rotation** — Basic: 15 exercises across stretch, strength, cardio, and wellness; Advanced: 90 science-based exercises across upper, lower, and core categories
- **3-session repeat rule** (Basic) — each exercise is shown for 3 breaks in a row so you can build familiarity before it changes
- **Bilateral cues** (Advanced) — a chime fires at the halfway point for one-sided exercises to prompt a side switch
- **Pause / Resume** — freeze the timer without losing your place
- **Reset** — restart the rest countdown from 30:00 at any time
- **Skip exercise** (Basic) — swap to the next exercise if the current one doesn't work for you
- **Break history** — log of every completed break or circuit shown in reverse chronological order
- **Browser notifications** — alerts when a break starts (requires permission)

## Setup

**Requirements:** Python 3.8+

### Mac / Linux

```bash
git clone https://github.com/nathanLittle-Rea/getFit.git
cd getFit/movr
pip install -r requirements.txt
python3 app.py
```

### Windows

```cmd
git clone https://github.com/nathanLittle-Rea/getFit.git
cd getFit\movr
pip install -r requirements.txt
python app.py
```

Then open [http://localhost:5050](http://localhost:5050) in your browser.

## Project Structure

```
getFit/
└── movr/
    ├── app.py                    # Flask server and exercise rotation logic
    ├── exercises.json            # Basic exercise library (15 exercises)
    ├── exercises_advanced.json   # Advanced exercise library (90 exercises: upper/lower/core)
    ├── requirements.txt
    ├── templates/
    │   └── index.html            # Main UI
    └── static/
        ├── style.css             # Dark theme styles
        └── timer.js              # Countdown logic and state machine
```

## How It Works

**Basic mode**
1. The timer counts down 30 minutes (auto-starts on page load)
2. When time is up (or you click **Start Break Now**), a 5-minute break begins
3. The current exercise is displayed — follow along for the full 5 minutes
4. Click **Done — Mark Complete** to log the break and restart the 30-minute cycle
5. After 3 completed breaks on the same exercise, it automatically rotates to the next one
6. Exercises are shuffled fresh each day

**Advanced mode**
1. Switch to Advanced using the mode toggle at the top
2. Each break is 7 minutes: 3 rounds of upper → lower → core (45 seconds each with automatic step progression)
3. For one-sided exercises, a chime fires halfway through to prompt a side switch
4. Click **Done — Mark Complete** after the circuit to log it and restart the rest timer
5. Upper, lower, and core exercises rotate independently through the 30-exercise pool for each category
