import json
import os
from flask import Flask, render_template, jsonify, request, session
from datetime import datetime
import random

app = Flask(__name__)
app.secret_key = os.urandom(24)

EXERCISES_FILE = os.path.join(os.path.dirname(__file__), "exercises.json")

def load_exercises():
    with open(EXERCISES_FILE) as f:
        return json.load(f)

def get_session_state():
    if "state" not in session:
        exercises = load_exercises()
        order = list(range(len(exercises)))
        random.shuffle(order)
        session["state"] = {
            "exercise_order": order,
            "current_index": 0,
            "repeat_count": 0,   # how many breaks this exercise has been shown
            "total_breaks": 0,
            "completed_breaks": [],
            "day": datetime.now().strftime("%Y-%m-%d"),
        }
    else:
        # Reset if it's a new day
        state = session["state"]
        if state.get("day") != datetime.now().strftime("%Y-%m-%d"):
            exercises = load_exercises()
            order = list(range(len(exercises)))
            random.shuffle(order)
            session["state"] = {
                "exercise_order": order,
                "current_index": 0,
                "repeat_count": 0,
                "total_breaks": 0,
                "completed_breaks": [],
                "day": datetime.now().strftime("%Y-%m-%d"),
            }
    return session["state"]

def current_exercise(state):
    exercises = load_exercises()
    idx = state["exercise_order"][state["current_index"] % len(state["exercise_order"])]
    return exercises[idx]

@app.route("/")
def index():
    return render_template("index.html")

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

    # Rotate to the next exercise after 3 repeats
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

if __name__ == "__main__":
    app.run(debug=True, port=5050)
