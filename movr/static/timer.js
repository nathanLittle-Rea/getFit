const REST_SECS           = 30 * 60;
const BREAK_SECS          =  5 * 60;
const ADVANCED_BREAK_SECS =  7 * 60;
const CIRCUIT_STEP_SECS   = 45;
const CIRCUMFERENCE       = 2 * Math.PI * 80;

let phase        = "rest";
let secondsLeft  = REST_SECS;
let tickInterval = null;
let paused       = false;
let exerciseData = null;
let notifGranted = false;

let exSecsLeft  = 0;
let exDone      = false;
let exInterval  = null;

let mode = localStorage.getItem("movr_mode") || "basic";

// Advanced circuit state
let circuitExercises = null;  // { upper, lower, core }
let circuitStep      = 0;     // 0-8
let circuitDone      = false;

let circuitTimerInterval = null;
let circuitSecsLeft      = 0;
let circuitTimerDone     = false;

function breakSecs() {
  return mode === "advanced" ? ADVANCED_BREAK_SECS : BREAK_SECS;
}

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

const pip1 = document.getElementById("pip1");
const pip2 = document.getElementById("pip2");
const pip3 = document.getElementById("pip3");

const mainBtn  = document.getElementById("mainBtn");
const skipBtn  = document.getElementById("skipBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

const historyList  = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const streakBadge  = document.getElementById("streakBadge");

const exTimerRow    = document.getElementById("exTimerRow");
const exTimerLabel  = document.getElementById("exTimerLabel");
const exTimerStatus = document.getElementById("exTimerStatus");

const notifDot  = document.getElementById("notifDot");
const notifText = document.getElementById("notifText");

// Mode toggle
const modeBasicBtn    = document.getElementById("modeBasicBtn");
const modeAdvancedBtn = document.getElementById("modeAdvancedBtn");

// Circuit elements
const circuitView  = document.getElementById("circuitView");
const setLabel     = document.getElementById("setLabel");
const setPip1      = document.getElementById("setPip1");
const setPip2      = document.getElementById("setPip2");
const setPip3      = document.getElementById("setPip3");

const cardUpper = document.getElementById("cardUpper");
const cardLower = document.getElementById("cardLower");
const cardCore  = document.getElementById("cardCore");

const upperIcon = document.getElementById("upperIcon");
const upperName = document.getElementById("upperName");
const upperDesc = document.getElementById("upperDesc");

const lowerIcon = document.getElementById("lowerIcon");
const lowerName = document.getElementById("lowerName");
const lowerDesc = document.getElementById("lowerDesc");

const coreIcon = document.getElementById("coreIcon");
const coreName = document.getElementById("coreName");
const coreDesc = document.getElementById("coreDesc");

const exTimerRowAdv    = document.getElementById("exTimerRowAdv");
const exTimerLabelAdv  = document.getElementById("exTimerLabelAdv");
const exTimerStatusAdv = document.getElementById("exTimerStatusAdv");

// ── Init ──────────────────────────────────────────────────
async function init() {
  applyMode();
  await requestNotifPermission();
  await fetchState();
  startTick();
}

function applyMode() {
  if (mode === "advanced") {
    modeAdvancedBtn.classList.add("active");
    modeBasicBtn.classList.remove("active");
    exerciseBlock.style.display = "none";
    circuitView.classList.remove("hidden");
    skipBtn.style.display = "none";
  } else {
    modeBasicBtn.classList.add("active");
    modeAdvancedBtn.classList.remove("active");
    exerciseBlock.style.display = "";
    circuitView.classList.add("hidden");
    skipBtn.style.display = "";
  }
}

async function requestNotifPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    notifGranted = true;
  } else if (Notification.permission !== "denied") {
    const perm = await Notification.requestPermission();
    notifGranted = (perm === "granted");
  }
  notifDot.className    = "notif-dot" + (notifGranted ? " enabled" : "");
  notifText.textContent = notifGranted
    ? "Browser notifications on"
    : "Enable notifications for break alerts";
}

async function fetchState() {
  if (mode === "advanced") {
    const res  = await fetch("/api/advanced/state");
    const data = await res.json();
    circuitExercises = { upper: data.upper, lower: data.lower, core: data.core };
    renderCircuitRest();
    renderHistory(data.completed_circuit_log, data.completed_circuits, true);
  } else {
    const res  = await fetch("/api/state");
    const data = await res.json();
    exerciseData = data;
    renderExercise(data.exercise, data.repeat_count);
    renderHistory(data.completed_breaks, data.total_breaks, false);
  }
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
    else autoEndBreak();
  } else if (phase === "rest" && secondsLeft === 5 * 60) {
    if (mode === "advanced") {
      notify("Break in 5 minutes",
        `Circuit: ${circuitExercises?.upper?.name ?? "..."}, ${circuitExercises?.lower?.name ?? "..."}, ${circuitExercises?.core?.name ?? "..."}`);
    } else {
      notify("Break in 5 minutes", `Up next: ${exerciseData?.exercise?.name ?? "an exercise"}`);
    }
  }
}

function renderTimer() {
  const total  = phase === "rest" ? REST_SECS : breakSecs();
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
    if (mode === "basic") exerciseBlock.classList.add("dimmed");
  } else {
    timerSublabel.textContent = "remaining";
    phaseLabel.textContent    = "Move! Break Active";
    phaseLabel.className      = "phase-label active";
    mainBtn.textContent       = "Done — Mark Complete";
    mainBtn.className         = "btn btn-primary break-mode";
    breakBanner.classList.add("visible");
    if (mode === "basic") exerciseBlock.classList.remove("dimmed");
  }
}

// ── Phase transitions ─────────────────────────────────────
function enterBreak() {
  phase       = "break";
  secondsLeft = breakSecs();
  renderTimer();
  startTick();
  chimeBreakStart();

  if (mode === "advanced") {
    notify("Time to move!",
      `Circuit: ${circuitExercises?.upper?.name ?? "..."}, ${circuitExercises?.lower?.name ?? "..."}, ${circuitExercises?.core?.name ?? "..."}`);
    startCircuit();
  } else {
    notify("Time to move!", `Your exercise: ${exerciseData?.exercise?.name ?? "Let's go!"}`);
    startExerciseTimer(exerciseData?.exercise?.duration_seconds ?? 60);
  }
}

async function autoEndBreak() {
  stopExerciseTimer();
  stopCircuitStep();
  clearInterval(tickInterval);
  tickInterval = null;
  secondsLeft  = 0;
  renderTimer();
}

async function completeBreak() {
  if (phase !== "break") {
    enterBreak();
    return;
  }

  if (mode === "advanced") {
    stopCircuitStep();
    const res  = await fetch("/api/advanced/complete", { method: "POST" });
    const data = await res.json();

    circuitExercises = { upper: data.next_upper, lower: data.next_lower, core: data.next_core };
    circuitStep = 0;
    circuitDone = false;
    renderCircuitRest();
    await refreshHistoryAdv();

    chimeBreakDone();
    notify("Great job!", `${data.completed_circuits} circuit${data.completed_circuits !== 1 ? "s" : ""} today`);
  } else {
    stopExerciseTimer();
    const res  = await fetch("/api/complete_break", { method: "POST" });
    const data = await res.json();

    exerciseData = data;
    renderExercise(data.next_exercise, data.repeat_count);
    await refreshHistory();

    chimeBreakDone();
    notify("Great job!", `${data.total_breaks} break${data.total_breaks !== 1 ? "s" : ""} today`);
  }

  phase       = "rest";
  secondsLeft = REST_SECS;
  renderTimer();
  startTick();
}

async function skipExercise() {
  if (mode === "advanced") return;
  const res  = await fetch("/api/skip_exercise", { method: "POST" });
  const data = await res.json();
  exerciseData = { exercise: data.exercise, repeat_count: data.repeat_count };
  renderExercise(data.exercise, data.repeat_count);
  if (phase === "break") {
    startExerciseTimer(data.exercise.duration_seconds ?? 60);
  }
}

// ── Circuit logic ─────────────────────────────────────────
function startCircuit() {
  circuitStep = 0;
  circuitDone = false;
  exTimerRowAdv.classList.remove("hidden");
  renderSetPips();
  startCircuitStep();
}

function startCircuitStep() {
  highlightCircuitStep(circuitStep);
  renderSetPips();
  const ex = exerciseForStep(circuitStep);
  startCircuitTimer(ex?.duration_seconds ?? CIRCUIT_STEP_SECS);
}

function exerciseForStep(step) {
  const i = step % 3;
  if (i === 0) return circuitExercises.upper;
  if (i === 1) return circuitExercises.lower;
  return circuitExercises.core;
}

function advanceCircuitStep() {
  circuitStep++;
  if (circuitStep >= 9) {
    circuitDone = true;
    stopCircuitStep();
    exTimerRowAdv.classList.add("hidden");
    [cardUpper, cardLower, cardCore].forEach(c => {
      c.classList.remove("active", "dimmed");
      c.classList.add("done");
    });
    renderSetPips();
    chimeBreakDone();
    return;
  }
  startCircuitStep();
}

function highlightCircuitStep(step) {
  const stepInSet = step % 3;
  const setNum    = Math.floor(step / 3);

  setLabel.textContent = `Set ${setNum + 1} of 3`;

  const cards = [cardUpper, cardLower, cardCore];
  cards.forEach((c, i) => {
    c.classList.remove("active", "dimmed", "done");
    if (i === stepInSet) {
      c.classList.add("active");
    } else if (i < stepInSet) {
      c.classList.add("done");
    } else {
      c.classList.add("dimmed");
    }
  });
}

function renderSetPips() {
  const completed = circuitDone ? 3 : Math.floor(circuitStep / 3);
  [setPip1, setPip2, setPip3].forEach((p, i) => {
    p.classList.toggle("filled", i < completed);
  });
}

function renderCircuitRest() {
  if (!circuitExercises) return;

  upperIcon.textContent = circuitExercises.upper.icon;
  upperName.textContent = circuitExercises.upper.name;
  upperDesc.textContent = circuitExercises.upper.description;

  lowerIcon.textContent = circuitExercises.lower.icon;
  lowerName.textContent = circuitExercises.lower.name;
  lowerDesc.textContent = circuitExercises.lower.description;

  coreIcon.textContent = circuitExercises.core.icon;
  coreName.textContent = circuitExercises.core.name;
  coreDesc.textContent = circuitExercises.core.description;

  setLabel.textContent = "Up Next";
  [cardUpper, cardLower, cardCore].forEach(c => {
    c.className = "circuit-card dimmed";
  });
  [setPip1, setPip2, setPip3].forEach(p => p.classList.remove("filled"));
  exTimerRowAdv.classList.add("hidden");
}

// ── Circuit timer ─────────────────────────────────────────
function startCircuitTimer(seconds) {
  clearInterval(circuitTimerInterval);
  circuitSecsLeft  = seconds;
  circuitTimerDone = false;
  renderCircuitTimer();
  circuitTimerInterval = setInterval(tickCircuitTimer, 1000);
}

function stopCircuitStep() {
  clearInterval(circuitTimerInterval);
  circuitTimerInterval = null;
}

function tickCircuitTimer() {
  circuitSecsLeft = Math.max(0, circuitSecsLeft - 1);
  renderCircuitTimer();

  const ex   = exerciseForStep(circuitStep);
  const half = Math.ceil((ex?.duration_seconds ?? CIRCUIT_STEP_SECS) / 2);
  if (ex?.bilateral && circuitSecsLeft === half && !circuitTimerDone) {
    chimeSwitchSides();
  }

  if (circuitSecsLeft === 0 && !circuitTimerDone) {
    circuitTimerDone = true;
    chimeExerciseDone();
    advanceCircuitStep();
  }
}

function renderCircuitTimer() {
  const m = String(Math.floor(circuitSecsLeft / 60)).padStart(2, "0");
  const s = String(circuitSecsLeft % 60).padStart(2, "0");
  exTimerLabelAdv.textContent = `${m}:${s}`;
  exTimerLabelAdv.className   = "ex-timer-clock";

  const setNum = Math.floor(circuitStep / 3) + 1;
  const exNum  = (circuitStep % 3) + 1;
  const ex     = exerciseForStep(circuitStep);
  const half   = Math.ceil((ex?.duration_seconds ?? CIRCUIT_STEP_SECS) / 2);

  let statusSuffix = "";
  if (ex?.bilateral) {
    statusSuffix = circuitSecsLeft > half ? " · left side" : " · right side";
  }
  exTimerStatusAdv.textContent = `set ${setNum} · exercise ${exNum}/3${statusSuffix}`;
}

// ── Basic exercise countdown ──────────────────────────────
function startExerciseTimer(seconds) {
  stopExerciseTimer();
  exSecsLeft = seconds;
  exDone     = false;
  renderExerciseTimer();
  exTimerRow.classList.remove("hidden");
  exInterval = setInterval(tickExercise, 1000);
}

function stopExerciseTimer() {
  clearInterval(exInterval);
  exInterval = null;
  exTimerRow.classList.add("hidden");
}

function tickExercise() {
  exSecsLeft = Math.max(0, exSecsLeft - 1);
  renderExerciseTimer();
  if (exSecsLeft === 0 && !exDone) {
    exDone = true;
    chimeExerciseDone();
  }
}

function renderExerciseTimer() {
  if (exDone && exSecsLeft === 0) {
    exTimerLabel.textContent  = "Done";
    exTimerLabel.className    = "ex-timer-clock done";
    exTimerStatus.textContent = "rest up";
  } else {
    const m = String(Math.floor(exSecsLeft / 60)).padStart(2, "0");
    const s = String(exSecsLeft % 60).padStart(2, "0");
    exTimerLabel.textContent  = `${m}:${s}`;
    exTimerLabel.className    = "ex-timer-clock";
    exTimerStatus.textContent = "exercise timer";
  }
}

// ── Render helpers ────────────────────────────────────────
function renderExercise(ex, repeatCount) {
  if (!ex) return;
  exIcon.textContent     = ex.icon;
  exName.textContent     = ex.name;
  exCategory.textContent = ex.category;
  exDesc.textContent     = ex.description;
  exDuration.textContent = ex.duration_note;

  [pip1, pip2, pip3].forEach((p, i) => {
    p.classList.toggle("filled", i < repeatCount);
  });
}

async function refreshHistory() {
  const res  = await fetch("/api/history");
  const data = await res.json();
  renderHistory(data.completed_breaks, data.total_breaks, false);
}

async function refreshHistoryAdv() {
  const res  = await fetch("/api/advanced/state");
  const data = await res.json();
  renderHistory(data.completed_circuit_log, data.completed_circuits, true);
}

function renderHistory(breaks, total, isAdvanced) {
  streakBadge.textContent = isAdvanced
    ? `${total} circuit${total !== 1 ? "s" : ""} today`
    : `${total} break${total !== 1 ? "s" : ""} today`;

  if (!breaks || breaks.length === 0) {
    historyEmpty.style.display = "block";
    historyList.style.display  = "none";
    return;
  }

  historyEmpty.style.display = "none";
  historyList.style.display  = "flex";
  historyList.innerHTML      = "";

  [...breaks].reverse().forEach(b => {
    const item = document.createElement("div");
    item.className = "history-item";
    if (isAdvanced) {
      item.innerHTML = `
        <span class="history-time">${b.time}</span>
        <span class="history-icon">${b.icon}</span>
        <span class="history-name">${b.upper} · ${b.lower} · ${b.core}</span>
      `;
    } else {
      item.innerHTML = `
        <span class="history-time">${b.time}</span>
        <span class="history-icon">${b.icon}</span>
        <span class="history-name">${b.exercise}</span>
      `;
    }
    historyList.appendChild(item);
  });
}

// ── Audio cues ────────────────────────────────────────────
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, startTime, duration, gainPeak = 0.3) {
  const ctx  = getAudioCtx();
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function chimeBreakStart() {
  const ctx = getAudioCtx();
  const t   = ctx.currentTime;
  playTone(523, t,       0.35);
  playTone(784, t + 0.2, 0.5);
}

function chimeBreakDone() {
  const ctx = getAudioCtx();
  const t   = ctx.currentTime;
  playTone(523, t,        0.25);
  playTone(659, t + 0.18, 0.25);
  playTone(784, t + 0.36, 0.5);
}

function chimeExerciseDone() {
  const ctx = getAudioCtx();
  const t   = ctx.currentTime;
  playTone(784, t,       0.25);
  playTone(523, t + 0.2, 0.45);
}

// Two short pulses — switch sides
function chimeSwitchSides() {
  const ctx = getAudioCtx();
  const t   = ctx.currentTime;
  playTone(660, t,        0.12);
  playTone(660, t + 0.18, 0.12);
}

// ── Notifications ─────────────────────────────────────────
function notify(title, body) {
  if (!notifGranted) return;
  try { new Notification(title, { body, icon: "/static/icon.png" }); } catch (_) {}
}

// ── Controls ──────────────────────────────────────────────
function togglePause() {
  if (paused) {
    paused = false;
    startTick();
    if (mode === "advanced" && phase === "break" && !circuitDone && !circuitTimerInterval) {
      startCircuitTimer(circuitSecsLeft);
    }
    pauseBtn.textContent = "Pause";
    pauseBtn.classList.remove("btn-paused");
  } else {
    paused = true;
    clearInterval(tickInterval);
    tickInterval = null;
    if (mode === "advanced") stopCircuitStep();
    pauseBtn.textContent = "Resume";
    pauseBtn.classList.add("btn-paused");
  }
}

function resetTimer() {
  stopExerciseTimer();
  stopCircuitStep();
  circuitStep = 0;
  circuitDone = false;
  if (mode === "advanced") renderCircuitRest();

  paused      = false;
  phase       = "rest";
  secondsLeft = REST_SECS;
  pauseBtn.textContent = "Pause";
  pauseBtn.classList.remove("btn-paused");
  startTick();
}

// ── Mode toggle ───────────────────────────────────────────
async function switchMode(newMode) {
  if (newMode === mode) return;
  mode = newMode;
  localStorage.setItem("movr_mode", mode);

  stopExerciseTimer();
  stopCircuitStep();
  circuitStep = 0;
  circuitDone = false;

  applyMode();
  await fetchState();

  // If mid-break, start the new mode's exercise timer immediately
  if (phase === "break") {
    if (mode === "advanced") {
      startCircuit();
    } else {
      startExerciseTimer(exerciseData?.exercise?.duration_seconds ?? 60);
    }
  }
}

// ── Event listeners ───────────────────────────────────────
mainBtn.addEventListener("click", completeBreak);
skipBtn.addEventListener("click", skipExercise);
pauseBtn.addEventListener("click", togglePause);
resetBtn.addEventListener("click", resetTimer);
modeBasicBtn.addEventListener("click",    () => switchMode("basic"));
modeAdvancedBtn.addEventListener("click", () => switchMode("advanced"));

// ── Boot ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
