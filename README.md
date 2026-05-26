# getFit

A lightweight Flask web app that keeps you moving throughout the day. Every 30 minutes it prompts a 5-minute movement break with a suggested exercise. Each exercise repeats for 3 consecutive breaks before rotating to the next one.

## Features

- **30/5 timer cycle** — 30-minute rest countdown, then a 5-minute active break
- **Exercise rotation** — 15 exercises across stretch, strength, cardio, and wellness categories
- **3-session repeat rule** — each exercise is shown for 3 breaks in a row so you can build familiarity before it changes
- **Pause / Resume** — freeze the timer without losing your place
- **Reset** — restart the rest countdown from 30:00 at any time
- **Skip exercise** — swap to the next exercise if the current one doesn't work for you
- **Break history** — log of every completed break shown in reverse chronological order
- **Browser notifications** — alerts when a break starts (requires permission)

## Setup

**Requirements:** Python 3.8+

```bash
git clone https://github.com/nathanLittle-Rea/getFit.git
cd getFit
pip install flask
python app.py
```

Then open [http://localhost:5050](http://localhost:5050) in your browser.

## Project Structure

```
getFit/
├── app.py              # Flask server and exercise rotation logic
├── exercises.json      # Exercise library (15 exercises)
├── templates/
│   └── index.html      # Main UI
└── static/
    ├── style.css       # Dark theme styles
    └── timer.js        # Countdown logic and state machine
```

## How It Works

1. The timer counts down 30 minutes
2. When time is up (or you click **Start Break Now**), a 5-minute break begins
3. The current exercise is displayed — follow along for the full 5 minutes
4. Click **Done — Mark Complete** to log the break and restart the 30-minute cycle
5. After 3 completed breaks on the same exercise, it automatically rotates to the next one
6. Exercises are shuffled fresh each day
