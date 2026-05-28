import json
import os
import time
from flask import Flask, render_template, jsonify, request, session
from datetime import datetime
import random

app = Flask(__name__)
app.secret_key = os.urandom(24)

EXERCISES_FILE          = os.path.join(os.path.dirname(__file__), "exercises.json")
EXERCISES_ADVANCED_FILE = os.path.join(os.path.dirname(__file__), "exercises_advanced.json")

# ── Data loading ──────────────────────────────────────────

def load_exercises():
    with open(EXERCISES_FILE, encoding="utf-8") as f:
        return json.load(f)

def load_advanced_exercises():
    with open(EXERCISES_ADVANCED_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return data["upper"], data["lower"], data["core"]

# ── Basic mode session ────────────────────────────────────

def get_session_state():
    today = datetime.now().strftime("%Y-%m-%d")
    if "state" not in session or session["state"].get("day") != today:
        exercises = load_exercises()
        order = list(range(len(exercises)))
        random.shuffle(order)
        session["state"] = {
            "exercise_order": order,
            "current_index": 0,
            "repeat_count": 0,
            "total_breaks": 0,
            "completed_breaks": [],
            "day": today,
        }
    return session["state"]

def current_exercise(state):
    exercises = load_exercises()
    idx = state["exercise_order"][state["current_index"] % len(state["exercise_order"])]
    return exercises[idx]

# ── Advanced mode session ─────────────────────────────────

def _fresh_advanced_state(today):
    upper_exs, lower_exs, core_exs = load_advanced_exercises()
    # First pass: sequential so posture-focused exercises (indices 0-9) come first
    return {
        "upper_order": list(range(len(upper_exs))),
        "lower_order": list(range(len(lower_exs))),
        "core_order":  list(range(len(core_exs))),
        "upper_index": 0,
        "lower_index": 0,
        "core_index":  0,
        "upper_pass": 0,   # 0 = first sequential pass, >0 = shuffled
        "lower_pass": 0,
        "core_pass":  0,
        "completed_circuits": 0,
        "completed_circuit_log": [],
        "day": today,
    }

def get_advanced_state():
    today = datetime.now().strftime("%Y-%m-%d")
    if "adv_state" not in session or session["adv_state"].get("day") != today:
        session["adv_state"] = _fresh_advanced_state(today)
    return session["adv_state"]

def _advance_index(state, category):
    """Advance one category index; shuffle on subsequent passes."""
    upper_exs, lower_exs, core_exs = load_advanced_exercises()
    sizes = {"upper": len(upper_exs), "lower": len(lower_exs), "core": len(core_exs)}
    size = sizes[category]
    idx_key   = f"{category}_index"
    order_key = f"{category}_order"
    pass_key  = f"{category}_pass"

    state[idx_key] += 1
    if state[idx_key] >= size:
        state[idx_key] = 0
        state[pass_key] += 1
        new_order = list(range(size))
        random.shuffle(new_order)
        state[order_key] = new_order

def current_circuit(adv_state):
    upper_exs, lower_exs, core_exs = load_advanced_exercises()
    u = upper_exs[adv_state["upper_order"][adv_state["upper_index"]]]
    l = lower_exs[adv_state["lower_order"][adv_state["lower_index"]]]
    c = core_exs[adv_state["core_order"][adv_state["core_index"]]]
    return u, l, c

# ── Routes ─────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", cache_bust=int(time.time()))

# Basic mode routes

@app.route("/api/state")
def api_state():
    state = get_session_state()
    exercise = current_exercise(state)
    return jsonify({
        "exercise": exercise,
        "repeat_count": state["repeat_count"],
        "repeats_remaining": max(0, 3 - state["repeat_count"]),
        "total_breaks": state["total_breaks"],
        "completed_breaks": state["completed_breaks"],
    })

@app.route("/api/complete_break", methods=["POST"])
def complete_break():
    state = get_session_state()
    exercise = current_exercise(state)

    state["total_breaks"] += 1
    state["repeat_count"] += 1
    state["completed_breaks"].append({
        "time": datetime.now().strftime("%H:%M"),
        "exercise": exercise["name"],
        "icon": exercise["icon"],
    })

    if state["repeat_count"] >= 3:
        state["current_index"] += 1
        state["repeat_count"] = 0

    session["state"] = state
    session.modified = True

    next_exercise = current_exercise(state)
    return jsonify({
        "success": True,
        "next_exercise": next_exercise,
        "repeat_count": state["repeat_count"],
        "total_breaks": state["total_breaks"],
    })

@app.route("/api/skip_exercise", methods=["POST"])
def skip_exercise():
    state = get_session_state()
    state["current_index"] += 1
    state["repeat_count"] = 0
    session["state"] = state
    session.modified = True
    exercise = current_exercise(state)
    return jsonify({"exercise": exercise, "repeat_count": 0})

@app.route("/api/history")
def api_history():
    state = get_session_state()
    return jsonify({
        "completed_breaks": state["completed_breaks"],
        "total_breaks": state["total_breaks"],
    })

# Advanced mode routes

@app.route("/api/advanced/state")
def api_advanced_state():
    adv = get_advanced_state()
    upper, lower, core = current_circuit(adv)
    return jsonify({
        "upper": upper,
        "lower": lower,
        "core":  core,
        "completed_circuits": adv["completed_circuits"],
        "completed_circuit_log": adv["completed_circuit_log"],
    })

@app.route("/api/advanced/complete", methods=["POST"])
def api_advanced_complete():
    adv = get_advanced_state()
    upper, lower, core = current_circuit(adv)

    adv["completed_circuits"] += 1
    adv["completed_circuit_log"].append({
        "time":  datetime.now().strftime("%H:%M"),
        "upper": upper["name"],
        "lower": lower["name"],
        "core":  core["name"],
        "icon":  upper["icon"],
    })

    _advance_index(adv, "upper")
    _advance_index(adv, "lower")
    _advance_index(adv, "core")

    session["adv_state"] = adv
    session.modified = True

    next_upper, next_lower, next_core = current_circuit(adv)
    return jsonify({
        "success": True,
        "next_upper": next_upper,
        "next_lower": next_lower,
        "next_core":  next_core,
        "completed_circuits": adv["completed_circuits"],
    })

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)
