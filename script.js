const BOARD_SIZE = 11;
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const turnText = document.getElementById("turnText");
const statusText = document.getElementById("statusText");
const blackCount = document.getElementById("blackCount");
const whiteCount = document.getElementById("whiteCount");
const captureText = document.getElementById("captureText");
const scoreText = document.getElementById("scoreText");
const logList = document.getElementById("logList");
const turnLogToggle = document.getElementById("turnLogToggle");
const turnLogPanel = document.getElementById("turnLogPanel");
const flickReadyText = document.getElementById("flickReadyText");
const blackGaugeValue = document.getElementById("blackGaugeValue");
const whiteGaugeValue = document.getElementById("whiteGaugeValue");
const blackGaugeFill = document.getElementById("blackGaugeFill");
const whiteGaugeFill = document.getElementById("whiteGaugeFill");
const boardTooltip = document.getElementById("boardTooltip");
const boardWrap = document.querySelector(".board-wrap");
const placeBtn = document.getElementById("placeBtn");
const flickBtn = document.getElementById("flickBtn");
const resetBtn = document.getElementById("resetBtn");
const undoBtn = document.getElementById("undoBtn");
const aiToggle = document.getElementById("aiToggle");
const flickControls = document.getElementById("flickControls");
const flickSettingsToggle = document.getElementById("flickSettingsToggle");
const flickSettingsPanel = document.getElementById("flickSettingsPanel");
const rulesToggle = document.getElementById("rulesToggle");
const rulesPanel = document.getElementById("rulesPanel");
const startOverlay = document.getElementById("startOverlay");
const victoryOverlay = document.getElementById("victoryOverlay");
const victoryStone = document.getElementById("victoryStone");
const victoryText = document.getElementById("victoryText");
const victorySubtext = document.getElementById("victorySubtext");
const victoryRematchBtn = document.getElementById("victoryRematchBtn");
const victoryMenuBtn = document.getElementById("victoryMenuBtn");
const phaseBanner = document.getElementById("phaseBanner");
const startAiBtn = document.getElementById("startAiBtn");
const startLocalBtn = document.getElementById("startLocalBtn");
const powerSlider = document.getElementById("powerSlider");
const bounceSlider = document.getElementById("bounceSlider");
const frictionSlider = document.getElementById("frictionSlider");
const powerValue = document.getElementById("powerValue");
const bounceValue = document.getElementById("bounceValue");
const frictionValue = document.getElementById("frictionValue");
const targetScoreInputs = document.querySelectorAll('input[name="targetScore"]');
const aiDifficultyInputs = document.querySelectorAll('input[name="aiDifficulty"]');

const openingTurns = 6;
const maxFlickCharge = 100;
const starPoints = [
  [3, 3],
  [3, 7],
  [5, 5],
  [7, 3],
  [7, 7],
];

const directionMap = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

let state = createInitialState();
let audioContext = null;
let lastVibrationAt = 0;
let phaseBannerTimer = null;
let padding = 72;
let boardSpan = canvas.width - padding * 2;
let cell = boardSpan / (BOARD_SIZE - 1);
let boardMin = padding;
let boardMax = canvas.width - padding;
let dragThreshold = cell * 0.45;
let stoneRadius = 26;

const forgePoints = [
  [3, 3],
  [3, 7],
  [7, 3],
  [7, 7],
];

const crownPoint = [5, 5];

function createInitialState() {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  return {
    board,
    currentPlayer: "black",
    mode: "place",
    winner: null,
    targetScore: 12,
    aiDifficulty: "normal",
    selectedStone: null,
    hoverCell: null,
    aiEnabled: true,
    aiThinking: false,
    animating: false,
    started: false,
    phaseBannerShown: false,
    message: "빈 교차점에 돌을 놓거나, 내 돌을 드래그해 알까기를 시도하세요.",
    lastMove: null,
    boardHistory: [serializeBoard(board)],
    captured: { black: 0, white: 0 },
    score: { black: 0, white: 0 },
    flickCharge: { black: 0, white: 0 },
    turnCount: 0,
    particles: [],
    animationStones: null,
    shake: { amplitude: 0, x: 0, y: 0 },
    undoStack: [],
    turnLog: [],
    drag: {
      active: false,
      startPx: null,
      currentPx: null,
      stone: null,
    },
  };
}

function resetGame() {
  if (phaseBannerTimer) {
    window.clearTimeout(phaseBannerTimer);
    phaseBannerTimer = null;
  }
  phaseBanner.classList.remove("show");
  phaseBanner.classList.add("hidden");
  hideVictoryOverlay();
  state = createInitialState();
  state.aiEnabled = aiToggle.checked;
  syncSliderLabels();
  resizeCanvas();
  syncUi();
  draw();
}

function startGame(withAi) {
  aiToggle.checked = withAi;
  resetGame();
  state.started = true;
  state.targetScore = getSelectedTargetScore();
  state.aiDifficulty = getSelectedAiDifficulty();
  state.message = withAi
    ? "새 판 시작. 흑 차례입니다. 백은 AI가 맡습니다."
    : "새 판 시작. 흑부터 순서대로 수를 두세요.";
  syncUi();
  draw();
}

function openStartMenu() {
  resetGame();
  state.started = false;
  state.message = "시작 메뉴에서 모드를 골라 주세요.";
  syncUi();
  draw();
}

function setMode(mode) {
  if (state.winner || state.aiThinking || state.animating) {
    return;
  }

  if (mode === "flick" && !canUseFlick(state.currentPlayer)) {
    state.message = state.turnCount < openingTurns
      ? `오프닝 ${openingTurns}수 동안은 놓기만 가능합니다.`
      : "알까기 게이지가 100일 때만 사용할 수 있습니다.";
    syncUi();
    draw();
    return;
  }

  state.mode = mode;
  state.selectedStone = null;
  state.drag.active = false;
  state.message = mode === "place"
    ? "빈 교차점에 돌을 놓아 세력을 넓히세요."
    : "내 돌을 튕기듯 드래그하면 자유 각도로 움직이고, 살아남은 돌은 가까운 선에 정렬됩니다.";
  syncUi();
  draw();
}

function syncUi() {
  placeBtn.classList.toggle("active", state.mode === "place");
  flickBtn.classList.toggle("active", state.mode === "flick");

  const currentName = state.currentPlayer === "black" ? "흑" : "백";
  turnText.textContent = state.winner ? "종료" : `${currentName}${state.aiThinking ? " AI" : ""}`;
  statusText.textContent = state.winner ? state.winner : state.message;
  flickReadyText.textContent = getFlickReadyText(state.currentPlayer);
  updateCounts();
  syncBoardTooltip();
  renderTurnLog();
  startOverlay.classList.toggle("hidden", state.started);
  flickSettingsPanel.classList.toggle("hidden", !flickSettingsToggle.checked);
  turnLogPanel.classList.toggle("hidden", !turnLogToggle.checked);
  rulesPanel.classList.toggle("hidden", !rulesToggle.checked);
  flickBtn.disabled = !state.started || state.aiThinking || state.animating || state.turnCount < openingTurns || !canUseFlick(state.currentPlayer);
  undoBtn.disabled = state.undoStack.length === 0 || state.aiThinking || state.animating || !state.started;
  flickControls.classList.toggle(
    "hidden",
    !(state.mode === "flick" && state.selectedStone && !state.winner && !state.aiThinking && !state.animating && state.started),
  );
}

function showVictoryOverlay(winnerPlayer) {
  victoryStone.classList.remove("black", "white");
  victoryStone.classList.add(winnerPlayer);
  victoryText.textContent = `${winnerPlayer === "black" ? "흑" : "백"} 승리!!`;
  victorySubtext.textContent = state.aiEnabled
    ? `${state.aiDifficulty === "easy" ? "쉬움" : state.aiDifficulty === "hard" ? "어려움" : "보통"} AI 규칙으로 완료`
    : "대국 종료";
  spawnVictoryBurst(winnerPlayer);
  playImpactSound(winnerPlayer === "black" ? 220 : 320, 0.95);
  vibrateDevice([24, 50, 24, 70, 24]);
  victoryOverlay.classList.remove("hidden");
}

function hideVictoryOverlay() {
  victoryOverlay.classList.add("hidden");
}

function rematchGame() {
  const withAi = aiToggle.checked;
  const selectedScore = state.targetScore;
  const selectedDifficulty = state.aiDifficulty;
  for (const input of targetScoreInputs) {
    input.checked = Number(input.value) === selectedScore;
  }
  for (const input of aiDifficultyInputs) {
    input.checked = input.value === selectedDifficulty;
  }
  startGame(withAi);
}

function updateCounts() {
  const counts = countStones(state.board);
  blackCount.textContent = String(counts.black);
  whiteCount.textContent = String(counts.white);
  captureText.textContent = `흑 ${state.captured.black} / 백 ${state.captured.white}`;
  scoreText.textContent = `흑 ${state.score.black} / 백 ${state.score.white}`;
  blackGaugeValue.textContent = `${state.flickCharge.black} / ${maxFlickCharge}`;
  whiteGaugeValue.textContent = `${state.flickCharge.white} / ${maxFlickCharge}`;
  blackGaugeFill.style.width = `${(state.flickCharge.black / maxFlickCharge) * 100}%`;
  whiteGaugeFill.style.width = `${(state.flickCharge.white / maxFlickCharge) * 100}%`;
}

function renderTurnLog() {
  if (!state.turnLog.length) {
    logList.innerHTML = '<p class="log-empty">아직 기록이 없습니다.</p>';
    return;
  }

  logList.innerHTML = state.turnLog
    .slice()
    .reverse()
    .map((entry) => `<p class="log-item">${entry}</p>`)
    .join("");
}

function getBoardTooltipContent(cellPos) {
  if (!cellPos || !isInside(cellPos.x, cellPos.y)) {
    return null;
  }
  if (isCrownPoint(cellPos.x, cellPos.y)) {
    return "왕점 +1점";
  }
  if (isForgePoint(cellPos.x, cellPos.y)) {
    return "화점 게이지 보너스";
  }
  return null;
}

function syncBoardTooltip() {
  const content = getBoardTooltipContent(state.hoverCell);
  if (!content) {
    boardTooltip.classList.add("hidden");
    return;
  }

  const center = cellCenter(state.hoverCell.x, state.hoverCell.y);
  boardTooltip.textContent = content;
  boardTooltip.style.left = `${center.x}px`;
  boardTooltip.style.top = `${center.y}px`;
  boardTooltip.classList.remove("hidden");
}

function getPhaseLabel() {
  if (state.turnCount < openingTurns) {
    return `오프닝 페이즈 ${state.turnCount + 1}/${openingTurns}`;
  }
  return "난전 페이즈";
}

function getFlickReadyText(player) {
  if (state.turnCount < openingTurns) {
    return `난전까지 ${openingTurns - state.turnCount}수`;
  }
  if (canUseFlick(player)) {
    return `${player === "black" ? "흑" : "백"} 사용 가능`;
  }

  const remainingCharge = Math.max(0, maxFlickCharge - state.flickCharge[player]);
  const baseTurns = Math.ceil(remainingCharge / 34);
  return `${player === "black" ? "흑" : "백"} ${baseTurns}수 남음`;
}

function isCrownPoint(x, y) {
  return x === crownPoint[0] && y === crownPoint[1];
}

function isForgePoint(x, y) {
  return forgePoints.some(([fx, fy]) => fx === x && fy === y);
}

function canUseFlick(player) {
  return state.turnCount >= openingTurns && state.flickCharge[player] >= maxFlickCharge;
}

function getChargeGain(moveType, x, y) {
  let gain = moveType === "place" ? 34 : 14;
  if (isForgePoint(x, y)) {
    gain += 16;
  }
  return gain;
}

function getComboBonus(parts) {
  const achieved = parts.filter((value) => value > 0).length;
  return achieved >= 2 ? achieved - 1 : 0;
}

function countStones(board) {
  let black = 0;
  let white = 0;

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (board[y][x] === "black") black += 1;
      if (board[y][x] === "white") white += 1;
    }
  }

  return { black, white };
}

function resizeCanvas() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const wrapWidth = boardWrap
    ? Math.max(220, Math.floor(boardWrap.getBoundingClientRect().width - 36))
    : Math.max(220, viewportWidth - 48);
  const maxByHeight = Math.min(1180, Math.max(220, viewportHeight - (viewportWidth <= 640 ? 260 : 180)));
  const size = Math.round(Math.max(220, Math.min(wrapWidth, maxByHeight)));

  canvas.width = size;
  canvas.height = size;

  padding = Math.max(28, Math.round(size * 0.084));
  boardSpan = canvas.width - padding * 2;
  cell = boardSpan / (BOARD_SIZE - 1);
  boardMin = padding;
  boardMax = canvas.width - padding;
  dragThreshold = cell * 0.45;
  stoneRadius = Math.max(10, Math.min(26, cell * 0.38));
}

function draw() {
  ctx.save();
  if (state.shake.amplitude > 0) {
    ctx.translate(state.shake.x, state.shake.y);
  }
  drawBoard();
  drawHighlights();
  if (state.animationStones) {
    drawPhysicsStones(state.animationStones);
  } else {
    drawStones();
  }
  drawDragGuide();
  drawParticles();
  ctx.restore();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const boardGradient = ctx.createLinearGradient(0, padding, 0, canvas.height - padding);
  boardGradient.addColorStop(0, "#ebc985");
  boardGradient.addColorStop(1, "#b57730");
  ctx.fillStyle = boardGradient;
  roundRect(ctx, 28, 28, canvas.width - 56, canvas.height - 56, 26);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 18; i += 1) {
    ctx.beginPath();
    ctx.moveTo(64 + i * 40, 30);
    ctx.bezierCurveTo(80 + i * 38, 220, 40 + i * 35, 560, 80 + i * 37, 830);
    ctx.strokeStyle = i % 2 === 0 ? "#71451e" : "#fbe1ab";
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(78, 45, 17, 0.78)";
  ctx.lineWidth = 2;
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const offset = padding + i * cell;
    ctx.beginPath();
    ctx.moveTo(padding, offset);
    ctx.lineTo(canvas.width - padding, offset);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset, padding);
    ctx.lineTo(offset, canvas.height - padding);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(74, 43, 14, 0.82)";
  for (const [x, y] of starPoints) {
    ctx.beginPath();
    ctx.arc(padding + x * cell, padding + y * cell, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const crown = cellCenter(crownPoint[0], crownPoint[1]);
  ctx.beginPath();
  ctx.arc(crown.x, crown.y, Math.max(10, cell * 0.14), 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 225, 130, 0.95)";
  ctx.lineWidth = 3;
  ctx.stroke();

  for (const [x, y] of forgePoints) {
    const point = cellCenter(x, y);
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(12, cell * 0.17), 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(110, 199, 193, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawHighlights() {
  if (state.hoverCell && state.mode === "place" && !state.winner && !state.aiThinking) {
    const { x, y } = state.hoverCell;
    if (isInside(x, y) && !state.board[y][x]) {
      const px = padding + x * cell;
      const py = padding + y * cell;
      ctx.beginPath();
      ctx.arc(px, py, 24, 0, Math.PI * 2);
      ctx.fillStyle = state.currentPlayer === "black"
        ? "rgba(20, 20, 20, 0.16)"
        : "rgba(255, 255, 255, 0.34)";
      ctx.fill();
    }
  }

  if (state.lastMove) {
    const px = padding + state.lastMove.x * cell;
    const py = padding + state.lastMove.y * cell;
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 121, 59, 0.92)";
    ctx.fill();
  }

  if (state.selectedStone) {
    const { x, y } = state.selectedStone;
    const px = padding + x * cell;
    const py = padding + y * cell;
    ctx.beginPath();
    ctx.arc(px, py, 34, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff7a3d";
    ctx.lineWidth = 5;
    ctx.stroke();
  }
}

function drawStones() {
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const stone = state.board[y][x];
      if (!stone) continue;
      drawStone(x, y, stone);
    }
  }
}

function drawPhysicsStones(stones) {
  for (const stone of stones) {
    if (!stone.alive) continue;
    drawStoneAt(stone.x, stone.y, stone.color);
  }
}

function drawStone(x, y, color) {
  const px = padding + x * cell;
  const py = padding + y * cell;
  drawStoneAt(px, py, color);
}

function drawStoneAt(px, py, color) {
  const radius = stoneRadius;

  const gradient = ctx.createRadialGradient(px - 9, py - 11, 7, px, py, radius);
  if (color === "black") {
    gradient.addColorStop(0, "#6d6d6d");
    gradient.addColorStop(0.35, "#2d2d2d");
    gradient.addColorStop(1, "#0d0d0d");
  } else {
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.65, "#f1ece2");
    gradient.addColorStop(1, "#cbc2b3");
  }

  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = color === "black" ? "rgba(0,0,0,0.65)" : "rgba(120, 106, 82, 0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawDragGuide() {
  if (!state.drag.active || !state.drag.startPx || !state.drag.currentPx) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(state.drag.startPx.x, state.drag.startPx.y);
  ctx.lineTo(state.drag.currentPx.x, state.drag.currentPx.y);
  ctx.strokeStyle = "rgba(110, 199, 193, 0.95)";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.stroke();

  const shotVector = getShotVectorFromDrag();
  if (shotVector && state.selectedStone) {
    const preview = previewFlickPath(state.board, state.selectedStone.x, state.selectedStone.y, shotVector);
    if (preview.length > 1) {
      ctx.beginPath();
      ctx.moveTo(preview[0].x, preview[0].y);
      for (let i = 1; i < preview.length; i += 1) {
        ctx.lineTo(preview[i].x, preview[i].y);
      }
      ctx.strokeStyle = "rgba(255, 244, 190, 0.8)";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.fill();
  }
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function getCellFromPosition(position) {
  return {
    x: Math.round((position.x - padding) / cell),
    y: Math.round((position.y - padding) / cell),
  };
}

function handlePointerDown(event) {
  if (!state.started || state.winner || state.aiThinking || state.animating) {
    return;
  }

  const position = getPointerPosition(event);
  const { x, y } = getCellFromPosition(position);
  if (!isInside(x, y)) {
    return;
  }

  if (state.mode === "place") {
    attemptPlace(x, y, { source: "human" });
    return;
  }

  if (!canUseFlick(state.currentPlayer)) {
    state.message = state.turnCount < openingTurns
      ? `오프닝 ${openingTurns}수 동안은 놓기만 가능합니다.`
      : "알까기 게이지가 부족합니다.";
    syncUi();
    draw();
    return;
  }

  if (state.board[y][x] !== state.currentPlayer) {
    state.message = "알까기는 내 돌에서만 시작할 수 있습니다.";
    syncUi();
    draw();
    return;
  }

  state.selectedStone = { x, y };
  state.drag.active = true;
  state.drag.stone = { x, y };
  state.drag.startPx = cellCenter(x, y);
  state.drag.currentPx = position;
  state.message = "드래그 방향과 세기에 따라 돌이 자유롭게 미끄러집니다.";
  canvas.setPointerCapture(event.pointerId);
  syncUi();
  draw();
}

function handlePointerMove(event) {
  const position = getPointerPosition(event);
  state.hoverCell = getCellFromPosition(position);
  if (state.drag.active) {
    state.drag.currentPx = position;
  }
  draw();
}

function handlePointerUp(event) {
  if (!state.drag.active) {
    return;
  }

  const position = getPointerPosition(event);
  state.drag.currentPx = position;
  const shotVector = getShotVectorFromDrag();
  state.drag.active = false;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (shotVector) {
    performFlick(shotVector, { source: "human" });
  } else {
    state.message = "드래그 거리가 짧아서 알까기가 취소됐습니다.";
    state.selectedStone = null;
    syncUi();
    draw();
  }
}

function getShotVectorFromDrag() {
  if (!state.drag.startPx || !state.drag.currentPx) {
    return null;
  }

  const dx = state.drag.currentPx.x - state.drag.startPx.x;
  const dy = state.drag.currentPx.y - state.drag.startPx.y;
  const length = Math.hypot(dx, dy);
  if (length < dragThreshold) {
    return null;
  }
  const multiplier = Number(powerSlider.value);
  const power = Math.min(42, Math.max(10, length * 0.16 * multiplier));
  return {
    vx: (dx / length) * power,
    vy: (dy / length) * power,
  };
}

function handleBoardClick(event) {
  if (!state.started || state.mode !== "flick" || state.winner || state.aiThinking || state.animating) {
    return;
  }

  const position = getPointerPosition(event);
  const { x, y } = getCellFromPosition(position);
  if (!isInside(x, y)) {
    return;
  }

  if (state.board[y][x] === state.currentPlayer) {
    state.selectedStone = { x, y };
    state.message = "드래그하거나 방향 버튼으로 알까기를 실행할 수 있습니다.";
    syncUi();
    draw();
  }
}

function attemptPlace(x, y, options = {}) {
  const source = options.source ?? "human";
  if (state.board[y][x]) {
    if (source === "human") {
      state.message = "이미 돌이 있는 자리입니다.";
      syncUi();
    }
    return false;
  }

  const snapshot = createUndoSnapshot();
  const result = simulatePlace(state.board, x, y, state.currentPlayer, getPreviousHash());
  if (!result.ok) {
    if (source === "human") {
      state.message = result.reason;
      syncUi();
      draw();
    }
    return false;
  }

  applyMoveResult({
    snapshot,
    board: result.board,
    message: result.message,
    capturedByCurrent: result.capturedByCurrent,
    pointsEarned: result.pointsEarned,
    chargeGain: result.chargeGain,
    lastMove: { x, y, type: "place" },
    boardHash: result.hash,
    source,
  });
  return true;
}

async function performFlick(directionOrVector, options = {}) {
  const source = options.source ?? "human";
  if (state.winner || state.mode !== "flick" || !state.selectedStone) {
    return false;
  }
  if (!canUseFlick(state.currentPlayer)) {
    if (source === "human") {
      state.message = state.turnCount < openingTurns
        ? `오프닝 ${openingTurns}수 동안은 놓기만 가능합니다.`
        : "알까기 게이지가 부족합니다.";
      syncUi();
      draw();
    }
    return false;
  }

  const { x, y } = state.selectedStone;
  const snapshot = createUndoSnapshot();
  const shotVector = typeof directionOrVector === "string"
    ? { vx: directionMap[directionOrVector][0] * 18, vy: directionMap[directionOrVector][1] * 18 }
    : directionOrVector;
  const result = simulateFlick(state.board, x, y, shotVector, state.currentPlayer, getPreviousHash());

  if (!result.ok) {
    if (source === "human") {
      state.message = result.reason;
      syncUi();
      draw();
    }
    return false;
  }

  if (result.animationStones?.length) {
    await playFlickAnimation(result.animationStones, result.animationEvents ?? []);
  }

  applyMoveResult({
    snapshot,
    board: result.board,
    message: result.message,
    capturedByCurrent: result.capturedByCurrent,
    pointsEarned: result.pointsEarned,
    pointsGivenToOpponent: result.pointsGivenToOpponent,
    chargeGain: result.chargeGain,
    spentFlickCharge: result.spentFlickCharge,
    knockedOutEnemy: result.knockedOutEnemy,
    lastMove: { x: result.endX, y: result.endY, type: "flick" },
    boardHash: result.hash,
    source,
  });
  return true;
}

function applyMoveResult(payload) {
  if (payload.snapshot) {
    state.undoStack.push(payload.snapshot);
  }
  state.board = payload.board;
  state.lastMove = payload.lastMove;
  state.selectedStone = null;
  state.drag.active = false;
  state.message = payload.message;
  state.boardHistory.push(payload.boardHash);
  state.captured[state.currentPlayer] += payload.capturedByCurrent;
  state.score[state.currentPlayer] += payload.pointsEarned ?? payload.capturedByCurrent;
  if (payload.pointsGivenToOpponent) {
    state.score[getOpponent(state.currentPlayer)] += payload.pointsGivenToOpponent;
  }
  if (payload.spentFlickCharge) {
    state.flickCharge[state.currentPlayer] = Math.max(0, state.flickCharge[state.currentPlayer] - payload.spentFlickCharge);
  }
  if (payload.chargeGain) {
    state.flickCharge[state.currentPlayer] = Math.min(maxFlickCharge, state.flickCharge[state.currentPlayer] + payload.chargeGain);
  }
  state.turnCount += 1;
  state.turnLog.push(formatTurnLogEntry(payload));

  if (payload.capturedByCurrent > 0 || payload.knockedOutEnemy || payload.pointsGivenToOpponent > 0) {
    spawnBurst(payload.lastMove.x, payload.lastMove.y, state.currentPlayer === "black" ? "#ffd37a" : "#86ece1");
    vibrateDevice([18, 24, 18]);
  }

  if (finalizeTurn()) {
    return;
  }
}

function finalizeTurn() {
  const winner = getWinner(state.board);
  if (winner) {
    state.winner = winner;
    const winnerPlayer = getWinnerPlayerFromMessage(winner);
    if (winnerPlayer) {
      showVictoryOverlay(winnerPlayer);
    }
    syncUi();
    draw();
    return true;
  }

  const nextTurnCount = state.turnCount;
  if (nextTurnCount >= openingTurns && !state.phaseBannerShown) {
    state.phaseBannerShown = true;
    showPhaseBanner();
  }

  state.currentPlayer = getOpponent(state.currentPlayer);
  state.mode = "place";
  state.selectedStone = null;
  state.message = state.aiEnabled && state.currentPlayer === "white"
    ? "백 AI가 수를 계산 중입니다."
    : "상대 차례입니다. 기본 행동은 놓기입니다. 필요하면 알까기로 바꾸세요.";
  syncUi();
  draw();
  maybeRunAiTurn();
  return false;
}

function showPhaseBanner() {
  if (phaseBannerTimer) {
    window.clearTimeout(phaseBannerTimer);
  }
  phaseBanner.classList.remove("hidden");
  window.requestAnimationFrame(() => {
    phaseBanner.classList.add("show");
  });
  phaseBannerTimer = window.setTimeout(() => {
    phaseBanner.classList.remove("show");
    phaseBannerTimer = window.setTimeout(() => {
      phaseBanner.classList.add("hidden");
    }, 240);
  }, 1600);
}

function formatTurnLogEntry(payload) {
  const player = state.currentPlayer === "black" ? "흑" : "백";
  const moveType = payload.lastMove.type === "flick" ? "알까기" : "놓기";
  const pointText = payload.pointsEarned > 0 ? ` +${payload.pointsEarned}점` : "";
  const giveText = payload.pointsGivenToOpponent > 0 ? ` / 상대 +${payload.pointsGivenToOpponent}점` : "";
  const chargeText = payload.chargeGain > 0 ? ` / 게이지 +${payload.chargeGain}` : "";
  return `${player} ${moveType} (${payload.lastMove.x + 1}, ${payload.lastMove.y + 1})${pointText}${giveText}${chargeText}`;
}

function createUndoSnapshot() {
  return {
    board: cloneBoard(state.board),
    currentPlayer: state.currentPlayer,
    mode: state.mode,
    winner: state.winner,
    selectedStone: state.selectedStone ? { ...state.selectedStone } : null,
    hoverCell: state.hoverCell ? { ...state.hoverCell } : null,
    aiEnabled: state.aiEnabled,
    aiThinking: false,
    animating: false,
    started: state.started,
    message: state.message,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    boardHistory: [...state.boardHistory],
    captured: { ...state.captured },
    score: { ...state.score },
    flickCharge: { ...state.flickCharge },
    turnCount: state.turnCount,
    turnLog: [...state.turnLog],
  };
}

function undoLastTurn() {
  if (!state.undoStack.length || state.aiThinking || state.animating) {
    return;
  }

  const snapshot = state.undoStack.pop();
  state.board = cloneBoard(snapshot.board);
  state.currentPlayer = snapshot.currentPlayer;
  state.mode = snapshot.mode;
  state.winner = snapshot.winner;
  state.selectedStone = snapshot.selectedStone;
  state.hoverCell = snapshot.hoverCell;
  state.aiEnabled = snapshot.aiEnabled;
  state.started = snapshot.started;
  state.message = "한 수를 되돌렸습니다.";
  state.lastMove = snapshot.lastMove;
  state.boardHistory = [...snapshot.boardHistory];
  state.captured = { ...snapshot.captured };
  state.score = { ...snapshot.score };
  state.flickCharge = { ...snapshot.flickCharge };
  state.turnCount = snapshot.turnCount;
  state.turnLog = [...snapshot.turnLog];
  state.animationStones = null;
  state.particles = [];
  state.shake = { amplitude: 0, x: 0, y: 0 };
  syncUi();
  draw();
}

function maybeRunAiTurn() {
  if (!state.aiEnabled || state.currentPlayer !== "white" || state.winner) {
    return;
  }

  state.aiThinking = true;
  syncUi();
  draw();

  window.setTimeout(() => {
    const move = chooseAiMove();
    state.aiThinking = false;
    if (!move || state.winner) {
      state.message = "백 AI가 둘 수를 찾지 못했습니다.";
      syncUi();
      draw();
      return;
    }

    state.mode = move.type;
    state.selectedStone = move.type === "flick" ? { x: move.from.x, y: move.from.y } : null;
    syncUi();

    if (move.type === "place") {
      attemptPlace(move.x, move.y, { source: "ai" });
    } else {
      void performFlick(move.vector, { source: "ai" });
    }
  }, 420);
}

function chooseAiMove() {
  const candidates = [];
  const difficulty = getAiDifficultyConfig();
  const angleVectors = canUseFlick("white") ? buildAiShotVectors(difficulty) : [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (state.board[y][x]) {
        if (state.board[y][x] === "white" && angleVectors.length > 0) {
          for (const candidateShot of angleVectors) {
            const result = simulateFlick(
              state.board,
              x,
              y,
              candidateShot.vector,
              "white",
              getPreviousHash(),
            );
            if (result.ok) {
              candidates.push({
                type: "flick",
                from: { x, y },
                vector: candidateShot.vector,
                score: scoreCandidate("white", result.board, result, difficulty) + candidateShot.bias,
              });
            }
          }
        }
        continue;
      }

      const result = simulatePlace(state.board, x, y, "white", getPreviousHash());
      if (result.ok) {
        candidates.push({
          type: "place",
          x,
          y,
          score: scoreCandidate("white", result.board, result, difficulty),
        });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  const topPoolSize = difficulty.pickPool;
  const pool = candidates.slice(0, Math.min(topPoolSize, candidates.length));
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildAiShotVectors(difficulty) {
  const vectors = [];
  for (let i = 0; i < difficulty.angleCount; i += 1) {
    const angle = (Math.PI * 2 * i) / difficulty.angleCount;
    vectors.push({
      vector: {
        vx: Math.cos(angle) * difficulty.shotPower,
        vy: Math.sin(angle) * difficulty.shotPower,
      },
      bias: i % difficulty.cardinalBiasDivisor === 0 ? 4 : 0,
    });
  }
  return vectors;
}

function getAiDifficultyConfig() {
  if (!state.aiEnabled) {
    return { angleCount: 12, shotPower: 16, pickPool: 1, cardinalBiasDivisor: 3, ownRiskPenalty: 26 };
  }
  if (state.aiDifficulty === "easy") {
    return { angleCount: 8, shotPower: 14, pickPool: 3, cardinalBiasDivisor: 2, ownRiskPenalty: 14 };
  }
  if (state.aiDifficulty === "hard") {
    return { angleCount: 20, shotPower: 18, pickPool: 1, cardinalBiasDivisor: 5, ownRiskPenalty: 42 };
  }
  return { angleCount: 12, shotPower: 16, pickPool: 2, cardinalBiasDivisor: 3, ownRiskPenalty: 26 };
}

function scoreCandidate(player, board, result, difficulty) {
  const opponent = getOpponent(player);
  let score = 0;

  const ownLongest = getLongestLine(board, player);
  const oppLongest = getLongestLine(board, opponent);
  score += ownLongest * 40;
  score -= oppLongest * 24;
  score += (result.capturedByCurrent || 0) * 30;
  score += (result.pointsEarned || 0) * 45;
  score += result.knockedOutEnemy ? 22 : 0;
  score -= result.killedOwn ? difficulty.ownRiskPenalty : 0;
  score += getWinnerPlayer(board) === player ? 10000 : 0;

  if (wouldCompleteFive(board, player)) {
    score += 2000;
  }

  if (wouldCompleteFive(board, opponent)) {
    score += 1200;
  }

  const centerDistance = Math.abs(5 - (result.endX ?? result.x ?? 5)) + Math.abs(5 - (result.endY ?? result.y ?? 5));
  score -= centerDistance * 3;

  return score;
}

function wouldCompleteFive(board, player) {
  return findFiveInRow(board, player) !== null;
}

function getLongestLine(board, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  let longest = 0;

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (board[y][x] !== player) continue;
      for (const [dx, dy] of directions) {
        let count = 1;
        let nx = x + dx;
        let ny = y + dy;
        while (isInside(nx, ny) && board[ny][nx] === player) {
          count += 1;
          nx += dx;
          ny += dy;
        }
        longest = Math.max(longest, count);
      }
    }
  }

  return longest;
}

function simulatePlace(board, x, y, player, previousHash) {
  const boardCopy = cloneBoard(board);
  boardCopy[y][x] = player;

  const capturedPoints = captureAdjacentGroups(boardCopy, x, y, getOpponent(player));
  const ownGroup = collectGroup(boardCopy, x, y);
  if (countLiberties(boardCopy, ownGroup) === 0 && capturedPoints.length === 0) {
    return { ok: false, reason: "자살수는 둘 수 없습니다." };
  }

  if (player === "black") {
    const forbidden = getForbiddenReason(boardCopy, x, y);
    if (forbidden) {
      return { ok: false, reason: forbidden };
    }
  }

  const hash = serializeBoard(boardCopy);
  if (previousHash && previousHash === hash) {
    return { ok: false, reason: "패 규칙 때문에 직전 판형으로는 돌아갈 수 없습니다." };
  }

  const lineBonus = getWinnerPlayer(boardCopy) === player ? 4 : 0;
  const crownBonus = isCrownPoint(x, y) ? 1 : 0;
  const comboBonus = getComboBonus([capturedPoints.length, lineBonus]);
  const chargeGain = getChargeGain("place", x, y);
  const winner = getWinner(boardCopy, {
    score: {
      black: state.score.black + (player === "black" ? capturedPoints.length + lineBonus + crownBonus + comboBonus : 0),
      white: state.score.white + (player === "white" ? capturedPoints.length + lineBonus + crownBonus + comboBonus : 0),
    },
  });
  const totalPoints = capturedPoints.length + lineBonus + crownBonus + comboBonus;
  return {
    ok: true,
    board: boardCopy,
    message: lineBonus > 0
      ? `5목 완성! ${4 + crownBonus + comboBonus}점을 얻었습니다.`
      : totalPoints > 0
        ? `놓기 성공! ${totalPoints}점을 얻었습니다.`
        : "돌을 놓았습니다.",
    capturedByCurrent: capturedPoints.length,
    pointsEarned: totalPoints,
    chargeGain,
    hash,
    winner,
    x,
    y,
  };
}

function simulateFlick(board, x, y, shotVector, player, previousHash) {
  if (!shotVector || Math.hypot(shotVector.vx, shotVector.vy) < 0.01) {
    return { ok: false, reason: "알까기 방향이 충분하지 않습니다." };
  }
  if (board[y][x] !== player) {
    return { ok: false, reason: "내 돌만 알까기로 밀 수 있습니다." };
  }

  const stones = createPhysicsStones(board);
  const shooter = stones.find((stone) => stone.gx === x && stone.gy === y && stone.color === player);
  if (!shooter) {
    return { ok: false, reason: "선택된 돌이 없습니다." };
  }

  const launchBoost = isForgePoint(x, y) ? 1.15 : 1;
  shooter.vx = shotVector.vx * launchBoost;
  shooter.vy = shotVector.vy * launchBoost;

  const flickState = runFlickSimulation(stones);
  const snapResult = snapPhysicsToBoard(flickState.stones, shooter.id);
  const boardCopy = snapResult.board;
  const removedByLiberty = resolveBoardAfterFlick(boardCopy);
  const capturedByCurrent = removedByLiberty[getOpponent(player)];
  const killedOwn = removedByLiberty[player] > 0 || flickState.knockedOut[player] > 0;
  const knockedOutEnemy = flickState.knockedOut[getOpponent(player)] > 0;
  const pointsGivenToOpponent = flickState.knockedOut[player];
  const lineBonus = getWinnerPlayer(boardCopy) === player ? 4 : 0;
  const shooterSurvived = Boolean(snapResult.focus);
  const crownBonus = shooterSurvived && isCrownPoint(snapResult.focus.x, snapResult.focus.y) ? 1 : 0;
  const comboBonus = getComboBonus([capturedByCurrent, flickState.knockedOut[getOpponent(player)], lineBonus]);
  const chargeGain = shooterSurvived ? getChargeGain("flick", snapResult.focus.x, snapResult.focus.y) : 0;
  const totalPoints = capturedByCurrent + flickState.knockedOut[getOpponent(player)] + lineBonus + crownBonus + comboBonus;

  const hash = serializeBoard(boardCopy);
  if (previousHash && previousHash === hash) {
    return { ok: false, reason: "패 규칙 때문에 같은 판형 반복은 허용되지 않습니다." };
  }

  return {
    ok: true,
    board: boardCopy,
    message: knockedOutEnemy
      ? `자유 알까기 성공! ${totalPoints}점을 얻었습니다.`
      : pointsGivenToOpponent > 0
        ? "알까기 중 내 돌이 떨어져 상대가 점수를 얻었습니다."
      : lineBonus > 0
        ? "알까기 후 5목 완성! 남은 돌이 가장 가까운 선에 다시 정렬됐습니다."
        : "알까기를 사용했고, 살아남은 돌들이 가장 가까운 선에 다시 정렬됐습니다.",
    capturedByCurrent,
    pointsEarned: totalPoints,
    pointsGivenToOpponent,
    chargeGain,
    spentFlickCharge: maxFlickCharge,
    knockedOutEnemy,
    killedOwn,
    hash,
    winner: getWinner(boardCopy, {
      score: {
        black: state.score.black
          + (player === "black" ? totalPoints : pointsGivenToOpponent),
        white: state.score.white
          + (player === "white" ? totalPoints : pointsGivenToOpponent),
      },
    }),
    endX: snapResult.focus?.x ?? x,
    endY: snapResult.focus?.y ?? y,
    animationStones: flickState.frames,
    animationEvents: flickState.events,
  };
}

function getWinner(board, options = {}) {
  const score = options.score ?? state.score;
  const winnerPlayer = getWinnerPlayer(board);
  if (winnerPlayer === "black") {
    return "흑 승리! 5목 완성과 함께 4점 보너스를 얻었습니다.";
  }
  if (winnerPlayer === "white") {
    return "백 승리! 5목 완성과 함께 4점 보너스를 얻었습니다.";
  }

  if (score.black >= state.targetScore) {
    return `흑 승리! ${state.targetScore}점을 먼저 달성했습니다.`;
  }
  if (score.white >= state.targetScore) {
    return `백 승리! ${state.targetScore}점을 먼저 달성했습니다.`;
  }
  return null;
}

function getSelectedTargetScore() {
  const selected = [...targetScoreInputs].find((input) => input.checked);
  return selected ? Number(selected.value) : 12;
}

function getSelectedAiDifficulty() {
  const selected = [...aiDifficultyInputs].find((input) => input.checked);
  return selected ? selected.value : "normal";
}

function getWinnerPlayerFromMessage(message) {
  if (!message) {
    return null;
  }
  if (message.startsWith("흑")) {
    return "black";
  }
  if (message.startsWith("백")) {
    return "white";
  }
  return null;
}

function getWinnerPlayer(board) {
  if (findFiveInRow(board, "black")) {
    return "black";
  }
  if (findFiveInRow(board, "white")) {
    return "white";
  }
  return null;
}

function findFiveInRow(board, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (board[y][x] !== player) continue;
      for (const [dx, dy] of directions) {
        let count = 1;
        let nx = x + dx;
        let ny = y + dy;
        while (isInside(nx, ny) && board[ny][nx] === player) {
          count += 1;
          nx += dx;
          ny += dy;
        }
        if (count >= 5) {
          return { x, y };
        }
      }
    }
  }

  return null;
}

function getForbiddenReason(board, moveX, moveY) {
  if (hasOverline(board, moveX, moveY, "black")) {
    return "흑의 6목 이상은 금수입니다.";
  }

  const openThrees = countOpenPatterns(board, moveX, moveY, "black", 3);
  if (openThrees >= 2) {
    return "흑의 쌍삼은 금수입니다.";
  }

  const openFours = countOpenPatterns(board, moveX, moveY, "black", 4);
  if (openFours >= 2) {
    return "흑의 쌍사는 금수입니다.";
  }

  return null;
}

function hasOverline(board, moveX, moveY, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (const [dx, dy] of directions) {
    const count = 1 + countDirection(board, moveX, moveY, dx, dy, player) + countDirection(board, moveX, moveY, -dx, -dy, player);
    if (count >= 6) {
      return true;
    }
  }
  return false;
}

function countOpenPatterns(board, moveX, moveY, player, target) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  let total = 0;

  for (const [dx, dy] of directions) {
    const cells = [];
    for (let step = -4; step <= 4; step += 1) {
      const x = moveX + dx * step;
      const y = moveY + dy * step;
      if (!isInside(x, y)) {
        cells.push("edge");
      } else if (x === moveX && y === moveY) {
        cells.push("stone");
      } else {
        if (board[y][x] === player) {
          cells.push("stone");
        } else if (board[y][x]) {
          cells.push("block");
        } else {
          cells.push("empty");
        }
      }
    }
    const line = cells.join(",");
    if (target === 3) {
      total += countMatches(line, [
        "empty,stone,stone,stone,empty",
        "empty,stone,stone,empty,stone,empty",
        "empty,stone,empty,stone,stone,empty",
      ]);
    } else {
      total += countMatches(line, [
        "empty,stone,stone,stone,stone,empty",
        "empty,stone,stone,stone,empty,stone,empty",
        "empty,stone,empty,stone,stone,stone,empty",
        "empty,stone,stone,empty,stone,stone,empty",
      ]);
    }
  }

  return total;
}

function countMatches(line, patterns) {
  let count = 0;
  for (const pattern of patterns) {
    if (line.includes(pattern)) {
      count += 1;
    }
  }
  return count;
}

function createPhysicsStones(board) {
  const stones = [];
  for (let gy = 0; gy < BOARD_SIZE; gy += 1) {
    for (let gx = 0; gx < BOARD_SIZE; gx += 1) {
      const color = board[gy][gx];
      if (!color) continue;
      const center = cellCenter(gx, gy);
      stones.push({
        id: `${gx},${gy}`,
        gx,
        gy,
        color,
        x: center.x,
        y: center.y,
        vx: 0,
        vy: 0,
        alive: true,
      });
    }
  }
  return stones;
}

function runFlickSimulation(stones) {
  const working = stones.map((stone) => ({ ...stone }));
  const knockedOut = { black: 0, white: 0 };
  const frames = [];
  const events = [];
  const friction = Number(frictionSlider.value);
  const wallBounce = Number(bounceSlider.value);

  for (let step = 0; step < 120; step += 1) {
    for (const stone of working) {
      if (!stone.alive) continue;
      stone.x += stone.vx;
      stone.y += stone.vy;
      stone.vx *= friction;
      stone.vy *= friction;
    }

    for (let i = 0; i < working.length; i += 1) {
      const a = working[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < working.length; j += 1) {
        const b = working[j];
        if (!b.alive) continue;
        const impact = resolveStoneCollision(a, b);
        if (impact > 0.2) {
          events.push({ type: "stone", intensity: Math.min(1, impact / 14), step });
        }
      }
    }

    const knockedThisStep = new Set();
    for (const stone of working) {
      if (!stone.alive) continue;
      const speed = Math.hypot(stone.vx, stone.vy);
      if (shouldFallOffBoard(stone, speed)) {
        knockedThisStep.add(stone.id);
        continue;
      }

      if (stone.x < boardMin + stoneRadius && speed < 16 + wallBounce * 8) {
        stone.x = boardMin + stoneRadius;
        stone.vx = Math.abs(stone.vx) * wallBounce;
        events.push({ type: "wall", intensity: Math.min(1, speed / 18), step });
      }
      if (stone.x > boardMax - stoneRadius && speed < 16 + wallBounce * 8) {
        stone.x = boardMax - stoneRadius;
        stone.vx = -Math.abs(stone.vx) * wallBounce;
        events.push({ type: "wall", intensity: Math.min(1, speed / 18), step });
      }
      if (stone.y < boardMin + stoneRadius && speed < 16 + wallBounce * 8) {
        stone.y = boardMin + stoneRadius;
        stone.vy = Math.abs(stone.vy) * wallBounce;
        events.push({ type: "wall", intensity: Math.min(1, speed / 18), step });
      }
      if (stone.y > boardMax - stoneRadius && speed < 16 + wallBounce * 8) {
        stone.y = boardMax - stoneRadius;
        stone.vy = -Math.abs(stone.vy) * wallBounce;
        events.push({ type: "wall", intensity: Math.min(1, speed / 18), step });
      }
    }

    for (const stone of working) {
      if (!stone.alive || !knockedThisStep.has(stone.id)) continue;
      stone.alive = false;
      knockedOut[stone.color] += 1;
    }

    frames.push(working.map((stone) => ({ ...stone })));

    const moving = working.some((stone) => stone.alive && Math.hypot(stone.vx, stone.vy) > 0.3);
    if (!moving && step > 12) {
      break;
    }
  }

  return {
    stones: working.filter((stone) => stone.alive),
    frames,
    events,
    knockedOut,
  };
}

function shouldFallOffBoard(stone, speed) {
  const edgeMargin = stoneRadius * 1.05;
  const outwardThreshold = 0.05;
  const outsideLeft = stone.x - stoneRadius <= boardMin;
  const outsideRight = stone.x + stoneRadius >= boardMax;
  const outsideTop = stone.y - stoneRadius <= boardMin;
  const outsideBottom = stone.y + stoneRadius >= boardMax;

  if (outsideLeft && stone.vx < -outwardThreshold) {
    return true;
  }
  if (outsideRight && stone.vx > outwardThreshold) {
    return true;
  }
  if (outsideTop && stone.vy < -outwardThreshold) {
    return true;
  }
  if (outsideBottom && stone.vy > outwardThreshold) {
    return true;
  }

  if (stone.x <= boardMin + edgeMargin && stone.vx < -outwardThreshold) {
    return true;
  }
  if (stone.x >= boardMax - edgeMargin && stone.vx > outwardThreshold) {
    return true;
  }
  if (stone.y <= boardMin + edgeMargin && stone.vy < -outwardThreshold) {
    return true;
  }
  if (stone.y >= boardMax - edgeMargin && stone.vy > outwardThreshold) {
    return true;
  }

  return (
    speed > 0.2 &&
    (
      outsideLeft ||
      outsideRight ||
      outsideTop ||
      outsideBottom
    )
  );
}

function resolveStoneCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const minDistance = stoneRadius * 2;

  if (distance === 0 || distance >= minDistance) {
    return 0;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  const relativeVelocity = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (relativeVelocity > 0) {
    const impulse = relativeVelocity * 0.92;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
    return impulse;
  }
  return 0;
}

function snapPhysicsToBoard(stones, preferredId) {
  const candidates = [];
  const occupied = new Set();

  for (let gy = 0; gy < BOARD_SIZE; gy += 1) {
    for (let gx = 0; gx < BOARD_SIZE; gx += 1) {
      candidates.push({ x: gx, y: gy, center: cellCenter(gx, gy) });
    }
  }

  const sortedStones = [...stones].sort((a, b) => {
    const da = distanceToNearestIntersection(a);
    const db = distanceToNearestIntersection(b);
    return da - db;
  });

  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  const snapped = [];

  for (const stone of sortedStones) {
    let best = null;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
      const key = `${candidate.x},${candidate.y}`;
      if (occupied.has(key)) continue;
      const distance = Math.hypot(stone.x - candidate.center.x, stone.y - candidate.center.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }

    if (!best) continue;
    occupied.add(`${best.x},${best.y}`);
    board[best.y][best.x] = stone.color;
    snapped.push({ ...stone, gx: best.x, gy: best.y, snapDistance: bestDistance });
  }

  const preferred = snapped.find((stone) => stone.id === preferredId);
  const focus = preferred
    ? { x: preferred.gx, y: preferred.gy }
    : null;

  return { board, focus };
}

function distanceToNearestIntersection(stone) {
  const nearestX = Math.round((stone.x - padding) / cell);
  const nearestY = Math.round((stone.y - padding) / cell);
  const clampedX = Math.min(BOARD_SIZE - 1, Math.max(0, nearestX));
  const clampedY = Math.min(BOARD_SIZE - 1, Math.max(0, nearestY));
  const center = cellCenter(clampedX, clampedY);
  return Math.hypot(stone.x - center.x, stone.y - center.y);
}

function previewFlickPath(board, x, y, shotVector) {
  const stones = createPhysicsStones(board);
  const shooter = stones.find((stone) => stone.gx === x && stone.gy === y);
  if (!shooter) {
    return [];
  }
  shooter.vx = shotVector.vx;
  shooter.vy = shotVector.vy;

  const points = [{ x: shooter.x, y: shooter.y }];
  const friction = Number(frictionSlider.value);
  const wallBounce = Number(bounceSlider.value);

  for (let step = 0; step < 18; step += 1) {
    shooter.x += shooter.vx;
    shooter.y += shooter.vy;
    shooter.vx *= friction;
    shooter.vy *= friction;

    if (shooter.x < boardMin + stoneRadius || shooter.x > boardMax - stoneRadius) {
      shooter.vx *= -wallBounce;
      shooter.x = Math.min(boardMax - stoneRadius, Math.max(boardMin + stoneRadius, shooter.x));
    }
    if (shooter.y < boardMin + stoneRadius || shooter.y > boardMax - stoneRadius) {
      shooter.vy *= -wallBounce;
      shooter.y = Math.min(boardMax - stoneRadius, Math.max(boardMin + stoneRadius, shooter.y));
    }

    points.push({ x: shooter.x, y: shooter.y });
    if (Math.hypot(shooter.vx, shooter.vy) < 0.8) {
      break;
    }
  }

  return points;
}

function resolveBoardAfterFlick(board) {
  const removed = { black: 0, white: 0 };
  let changed = true;
  while (changed) {
    changed = false;
    const visited = new Set();
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const stone = board[y][x];
        if (!stone) continue;
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        const group = collectGroup(board, x, y);
        for (const point of group) {
          visited.add(`${point.x},${point.y}`);
        }
        if (countLiberties(board, group) === 0) {
          for (const point of group) {
            removed[board[point.y][point.x]] += 1;
            board[point.y][point.x] = null;
          }
          changed = true;
        }
      }
    }
  }
  return removed;
}

function captureAdjacentGroups(board, x, y, targetColor) {
  const captured = [];
  const visited = new Set();

  for (const [nx, ny] of getNeighbors(x, y)) {
    if (!isInside(nx, ny) || board[ny][nx] !== targetColor) {
      continue;
    }

    const key = `${nx},${ny}`;
    if (visited.has(key)) {
      continue;
    }

    const group = collectGroup(board, nx, ny);
    for (const point of group) {
      visited.add(`${point.x},${point.y}`);
    }

    if (countLiberties(board, group) === 0) {
      for (const point of group) {
        board[point.y][point.x] = null;
        captured.push(point);
      }
    }
  }

  return captured;
}

function collectGroup(board, startX, startY) {
  const color = board[startY][startX];
  const stack = [{ x: startX, y: startY }];
  const visited = new Set([`${startX},${startY}`]);
  const group = [];

  while (stack.length > 0) {
    const node = stack.pop();
    group.push(node);

    for (const [nx, ny] of getNeighbors(node.x, node.y)) {
      const key = `${nx},${ny}`;
      if (!isInside(nx, ny) || visited.has(key)) {
        continue;
      }
      if (board[ny][nx] === color) {
        visited.add(key);
        stack.push({ x: nx, y: ny });
      }
    }
  }

  return group;
}

function countLiberties(board, group) {
  const liberties = new Set();
  for (const point of group) {
    for (const [nx, ny] of getNeighbors(point.x, point.y)) {
      if (isInside(nx, ny) && !board[ny][nx]) {
        liberties.add(`${nx},${ny}`);
      }
    }
  }
  return liberties.size;
}

function countDirection(board, x, y, dx, dy, player) {
  let count = 0;
  let nx = x + dx;
  let ny = y + dy;
  while (isInside(nx, ny) && board[ny][nx] === player) {
    count += 1;
    nx += dx;
    ny += dy;
  }
  return count;
}

function getNeighbors(x, y) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function serializeBoard(board) {
  return board.map((row) => row.map((cellValue) => {
    if (cellValue === "black") return "b";
    if (cellValue === "white") return "w";
    return ".";
  }).join("")).join("|");
}

function getPreviousHash() {
  if (state.boardHistory.length < 2) {
    return null;
  }
  return state.boardHistory[state.boardHistory.length - 2];
}

function isInside(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function getOpponent(player) {
  return player === "black" ? "white" : "black";
}

function cellCenter(x, y) {
  return {
    x: padding + x * cell,
    y: padding + y * cell,
  };
}

function spawnBurst(x, y, color) {
  const center = cellCenter(x, y);
  for (let i = 0; i < 10; i += 1) {
    state.particles.push({
      x: center.x,
      y: center.y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: 18 + Math.random() * 18,
      radius: 3 + Math.random() * 4,
      color,
    });
  }
}

function spawnVictoryBurst(winnerPlayer) {
  const color = winnerPlayer === "black" ? "#ffd37a" : "#d8f5ff";
  for (let i = 0; i < 44; i += 1) {
    state.particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
      life: 40 + Math.random() * 28,
      radius: 4 + Math.random() * 5,
      color,
    });
  }
}

function playFlickAnimation(frames, events) {
  if (!frames.length) {
    return Promise.resolve();
  }

  state.animating = true;
  return new Promise((resolve) => {
    let index = 0;
    function step() {
      state.animationStones = frames[index];
      const frameEvents = events.filter((event) => event.step === index);
      for (const event of frameEvents) {
        triggerImpactEffect(event);
      }
      draw();
      index += 1;
      if (index < frames.length) {
        window.requestAnimationFrame(step);
      } else {
        state.animationStones = null;
        state.animating = false;
        syncUi();
        draw();
        resolve();
      }
    }
    syncUi();
    window.requestAnimationFrame(step);
  });
}

function triggerImpactEffect(event) {
  const intensity = event.intensity ?? 0.4;
  state.shake.amplitude = Math.max(state.shake.amplitude, 2 + intensity * 10);
  playImpactSound(event.type === "wall" ? 180 : 260, intensity);
  if (intensity > 0.45) {
    vibrateDevice(12);
  }
}

function playImpactSound(baseFrequency, intensity) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }
  if (!audioContext) {
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(baseFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 0.72, now + 0.08);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.03 + intensity * 0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.13);
}

function vibrateDevice(pattern) {
  if (!navigator.vibrate) {
    return;
  }
  const now = Date.now();
  if (now - lastVibrationAt < 90) {
    return;
  }
  lastVibrationAt = now;
  navigator.vibrate(pattern);
}

function syncSliderLabels() {
  powerValue.textContent = `${Number(powerSlider.value).toFixed(1)}x`;
  bounceValue.textContent = Number(bounceSlider.value).toFixed(2);
  frictionValue.textContent = Number(frictionSlider.value).toFixed(3);
}

function tickParticles() {
  if (state.shake.amplitude > 0.1) {
    state.shake.x = (Math.random() - 0.5) * state.shake.amplitude;
    state.shake.y = (Math.random() - 0.5) * state.shake.amplitude;
    state.shake.amplitude *= 0.84;
  } else if (state.shake.amplitude !== 0) {
    state.shake.amplitude = 0;
    state.shake.x = 0;
    state.shake.y = 0;
  }

  if (state.particles.length === 0) {
    if (state.shake.amplitude > 0) {
      draw();
    }
    return;
  }
  state.particles = state.particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx,
      y: particle.y + particle.vy,
      vy: particle.vy + 0.04,
      life: particle.life - 1,
      radius: Math.max(0.4, particle.radius - 0.08),
    }))
    .filter((particle) => particle.life > 0);
  draw();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointerleave", () => {
  state.hoverCell = null;
  syncBoardTooltip();
  draw();
});
canvas.addEventListener("click", handleBoardClick);

placeBtn.addEventListener("click", () => setMode("place"));
flickBtn.addEventListener("click", () => setMode("flick"));
resetBtn.addEventListener("click", openStartMenu);
undoBtn.addEventListener("click", undoLastTurn);
startAiBtn.addEventListener("click", () => startGame(true));
startLocalBtn.addEventListener("click", () => startGame(false));
victoryRematchBtn.addEventListener("click", rematchGame);
victoryMenuBtn.addEventListener("click", openStartMenu);
aiToggle.addEventListener("change", () => {
  state.aiEnabled = aiToggle.checked;
  state.message = state.aiEnabled ? "백 AI가 활성화되었습니다." : "백 AI를 끄고 2인 플레이로 전환했습니다.";
  syncUi();
  draw();
  maybeRunAiTurn();
});

for (const button of flickControls.querySelectorAll("button")) {
  button.addEventListener("click", () => {
    void performFlick(button.dataset.dir, { source: "human" });
  });
}

powerSlider.addEventListener("input", syncSliderLabels);
bounceSlider.addEventListener("input", syncSliderLabels);
frictionSlider.addEventListener("input", syncSliderLabels);
flickSettingsToggle.addEventListener("change", syncUi);
turnLogToggle.addEventListener("change", syncUi);
rulesToggle.addEventListener("change", syncUi);

window.setInterval(tickParticles, 33);
window.addEventListener("resize", () => {
  resizeCanvas();
  draw();
});

state.aiEnabled = aiToggle.checked;
syncSliderLabels();
resizeCanvas();
syncUi();
draw();
