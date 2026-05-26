const REST_SECS  = 30 * 60;   // 30 minutes
const BREAK_SECS =  5 * 60;   // 5 minutes
const CIRCUMFERENCE = 2 * Math.PI * 80;  // r=80 on the SVG ring

let phase        = "rest";    // "rest" | "break"
let secondsLeft  = REST_SECS;
let tickInterval = null;
let paused       = false;
let exerciseData = null;
let notifGranted = false;

// ── DOM refs ──────────────────────────────────────────────
const timerLabel    = document.getElementById("timerLabel");
const timerSublabel = document.getElementById("timerSublabel");
const phaseLabel    = document.getElementById("phaseLabel");
const ringProgress  = document.getElementById("ringProgress");
const breakBanner   = document.getElementById("breakBanner");

const exIcon        = document.getElementById("exIcon");
const exName        = document.getElementById("exName");
const exCategory    = document.getElementById("exCategory");
const exDesc        = document.getElementById("exDesc");
const exDuration    = document.getElementById("exDuration");
const exerciseBlock = document.getElementById("exerciseBlock");

const pip1          = document.getElementById("pip1");
const pip2          = document.getElementById("pip2");
const pip3          = document.getElementById("pip3");

const mainBtn       = document.getElementById("mainBtn");
const skipBtn       = document.getElementById("skipBtn");
const pauseBtn      = document.getElementById("pauseBtn");
const resetBtn      = document.getElementById("resetBtn");

const historyList   = document.getElementById("historyList");
const historyEmpty  = document.getElementById("historyEmpty");
const streakBadge   = document.getElementById("streakBadge");

const notifDot      = document.getElementById("notifDot");
const notifText     = document.getElementById("notifText");

// ── Init ──────────────────────────────────────────────────
async function init() {
  await requestNotifPermission();
  await fetchState();
  startTick();
}

async function requestNotifPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    notifGranted = true;
  } else if (Notification.permission !== "denied") {
    const perm = await Notification.requestPermission();
    notifGranted = (perm === "granted");
  }
  notifDot.className  = "notif-dot" + (notifGranted ? " enabled" : "");
  notifText.textContent = notifGranted
    ? "Browser notifications on"
    : "Enable notifications for break alerts";
}

async function fetchState() {
  const res  = await fetch("/api/state");
  const data = await res.json();
  exerciseData = data;
  renderExercise(data.exercise, data.repeat_count);
  renderHistory(data.completed_breaks, data.total_breaks);
}

// ── Tick ─────────────────────────────────────────────────
function startTick() {
  clearInterval(tickInterval);
  tickInterval = setInterval(tick, 1000);
  renderTimer();
}

function tick() {
  secondsLeft = Math.max(0, secondsLeft - 1);
  renderTimer();
  if (secondsLeft === 0) {
    if (phase === "rest") enterBreak();
    // break expiry: user should click done, but auto-end if they ignore
    else autoEndBreak();
  }
}

function renderTimer() {
  const total  = phase === "rest" ? REST_SECS : BREAK_SECS;
  const frac   = secondsLeft / total;
  const offset = CIRCUMFERENCE * (1 - frac);

  ringProgress.style.strokeDashoffset = offset;
  ringProgress.classList.toggle("break-mode", phase === "break");

  const m = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const s = String(secondsLeft % 60).padStart(2, "0");
  timerLabel.textContent = `${m}:${s}`;

  if (phase === "rest") {
    timerSublabel.textContent = "until next break";
    phaseLabel.textContent    = "Rest";
    phaseLabel.className      = "phase-label rest";
    mainBtn.textContent       = "Start Break Now";
    mainBtn.className         = "btn btn-primary";
    breakBanner.classList.remove("visible");
    exerciseBlock.classList.add("dimmed");
  } else {
    timerSublabel.textContent = "remaining";
    phaseLabel.textContent    = "Move! Break Active";
    phaseLabel.className      = "phase-label active";
    mainBtn.textContent       = "Done — Mark Complete";
    mainBtn.className         = "btn btn-primary break-mode";
    breakBanner.classList.add("visible");
    exerciseBlock.classList.remove("dimmed");
  }
}

// ── Phase transitions ─────────────────────────────────────
function enterBreak() {
  phase       = "break";
  secondsLeft = BREAK_SECS;
  renderTimer();
  notify("Time to move!", `Your exercise: ${exerciseData?.exercise?.name ?? "Let's go!"}`);
}

async function autoEndBreak() {
  // silently complete and move to rest without marking done
  phase       = "rest";
  secondsLeft = REST_SECS;
  renderTimer();
}

async function completeBreak() {
  if (phase !== "break") {
    // Manually start a break
    enterBreak();
    return;
  }
  const res  = await fetch("/api/complete_break", { method: "POST" });
  const data = await res.json();

  exerciseData = data;
  renderExercise(data.next_exercise, data.repeat_count);
  await refreshHistory();

  phase       = "rest";
  secondsLeft = REST_SECS;
  renderTimer();

  notify("Great job!", `${data.total_breaks} break${data.total_breaks !== 1 ? "s" : ""} completed today 🎉`);
}

async function skipExercise() {
  const res  = await fetch("/api/skip_exercise", { method: "POST" });
  const data = await res.json();
  exerciseData = { exercise: data.exercise, repeat_count: data.repeat_count };
  renderExercise(data.exercise, data.repeat_count);
}

// ── Render helpers ────────────────────────────────────────
function renderExercise(ex, repeatCount) {
  if (!ex) return;
  exIcon.textContent     = ex.icon;
  exName.textContent     = ex.name;
  exCategory.textContent = ex.category;
  exDesc.textContent     = ex.description;
  exDuration.textContent = ex.duration_note;

  const pips = [pip1, pip2, pip3];
  pips.forEach((p, i) => {
    p.classList.toggle("filled", i < repeatCount);
  });
}

async function refreshHistory() {
  const res  = await fetch("/api/history");
  const data = await res.json();
  renderHistory(data.completed_breaks, data.total_breaks);
}

function renderHistory(breaks, total) {
  streakBadge.textContent = `${total} break${total !== 1 ? "s" : ""} today`;

  if (!breaks || breaks.length === 0) {
    historyEmpty.style.display  = "block";
    historyList.style.display   = "none";
    return;
  }

  historyEmpty.style.display  = "none";
  historyList.style.display   = "flex";
  historyList.innerHTML       = "";

  // Show most recent first
  [...breaks].reverse().forEach(b => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <span class="history-time">${b.time}</span>
      <span class="history-icon">${b.icon}</span>
      <span class="history-name">${b.exercise}</span>
    `;
    historyList.appendChild(item);
  });
}

// ── Notifications ─────────────────────────────────────────
function notify(title, body) {
  if (!notifGranted) return;
  try {
    new Notification(title, { body, icon: "/static/icon.png" });
  } catch (_) {}
}

function togglePause() {
  if (paused) {
    paused = false;
    startTick();
    pauseBtn.textContent = "Pause";
    pauseBtn.classList.remove("btn-paused");
  } else {
    paused = true;
    clearInterval(tickInterval);
    tickInterval = null;
    pauseBtn.textContent = "Resume";
    pauseBtn.classList.add("btn-paused");
  }
}

function resetTimer() {
  paused      = false;
  phase       = "rest";
  secondsLeft = REST_SECS;
  pauseBtn.textContent = "Pause";
  pauseBtn.classList.remove("btn-paused");
  startTick();
}

// ── Event listeners ───────────────────────────────────────
mainBtn.addEventListener("click", completeBreak);
skipBtn.addEventListener("click", skipExercise);
pauseBtn.addEventListener("click", togglePause);
resetBtn.addEventListener("click", resetTimer);

// ── Boot ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
