import { Chess } from "./vendor/chess.js";

const START_MS = 4 * 60 * 1000;
const LOW_MS = 20 * 1000;
const FILES = "abcdefgh";
const VS = "︎"; // text presentation, so pieces never render as emoji
const GLYPH = { k: ["♚", "♔"], q: ["♛", "♕"], r: ["♜", "♖"], b: ["♝", "♗"], n: ["♞", "♘"], p: ["♟", "♙"] };
const NAME = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const LEVEL_NAME = { easy: "Easy", medium: "Medium", master: "Grand Master" };
const BOT_MIN_DELAY = { easy: 700, medium: 900, master: 500 };
const COLOR_NAME = { w: "White", b: "Black" };

const $ = (id) => document.getElementById(id);
const el = {
  board: $("board"),
  promo: $("promo"),
  promoChoices: $("promo-choices"),
  result: $("result"),
  resultTitle: $("result-title"),
  resultReason: $("result-reason"),
  setup: $("setup"),
  gamePanel: $("game-panel"),
  levelField: $("level-field"),
  colorField: $("color-field"),
  status: $("status"),
  moves: $("moves"),
  confirm: $("confirm-resign"),
  confirmText: $("confirm-text"),
  undo: $("btn-undo"),
  resign: $("btn-resign"),
  top: { name: $("name-top"), cap: $("cap-top"), clock: $("clock-top") },
  bottom: { name: $("name-bottom"), cap: $("cap-bottom"), clock: $("clock-bottom") },
};

let game = new Chess();
const state = {
  inGame: false,
  mode: "bot",
  level: "medium",
  colorChoice: "w",
  human: "w",
  orientation: "w",
  selected: null,
  targets: [],
  lastMove: null,
  over: null,
  clocks: { w: START_MS, b: START_MS },
  clockRunning: false,
  turnStart: 0,
  botThinking: false,
  pendingPromo: null,
  token: 0,
};
let worker = null;

/* ---------- Helpers ---------- */

const opposite = (c) => (c === "w" ? "b" : "w");
const isHumanTurn = () => state.mode === "pvp" || game.turn() === state.human;

function pieceHTML(type, color) {
  const [fill, line] = GLYPH[type];
  return `<span class="pc ${color}" aria-hidden="true"><span class="fill">${fill}${VS}</span>` +
    (color === "w" ? `<span class="line">${line}${VS}</span>` : "") + `</span>`;
}

function remaining(color) {
  let ms = state.clocks[color];
  if (state.clockRunning && !state.over && game.turn() === color) ms -= performance.now() - state.turnStart;
  return Math.max(0, ms);
}

function formatClock(ms) {
  if (ms < LOW_MS) {
    const s = Math.floor(ms / 1000);
    return `0:${String(s).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
  }
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// A side that only has its king, or king plus one knight or bishop, can never checkmate.
function cannotMate(color) {
  const pieces = [];
  for (const row of game.board()) for (const p of row) if (p && p.color === color && p.type !== "k") pieces.push(p.type);
  return pieces.length === 0 || (pieces.length === 1 && (pieces[0] === "n" || pieces[0] === "b"));
}

function playerName(color) {
  if (state.mode === "pvp") return COLOR_NAME[color];
  return color === state.human ? `You (${COLOR_NAME[color]})` : `Bot · ${LEVEL_NAME[state.level]}`;
}

/* ---------- Board ---------- */

function buildBoard() {
  el.board.innerHTML = "";
  for (let i = 0; i < 64; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sq";
    btn.setAttribute("role", "gridcell");
    el.board.appendChild(btn);
  }
  assignSquares();
}

function assignSquares() {
  [...el.board.children].forEach((btn, i) => {
    const row = i >> 3, col = i & 7;
    const file = state.orientation === "w" ? col : 7 - col;
    const rank = state.orientation === "w" ? 8 - row : row + 1;
    btn.dataset.square = FILES[file] + rank;
    btn.dataset.edgeFile = row === 7 ? FILES[file] : "";
    btn.dataset.edgeRank = col === 0 ? String(rank) : "";
    btn.dataset.dark = (file + rank) % 2 === 1 ? "1" : "0";
  });
}

function render() {
  const turn = game.turn();
  const inCheck = game.inCheck();
  const canAct = state.inGame && !state.over && !state.pendingPromo && isHumanTurn() && !state.botThinking;

  for (const btn of el.board.children) {
    const sq = btn.dataset.square;
    const piece = game.get(sq);
    const cls = ["sq", btn.dataset.dark === "1" ? "dark" : "light"];
    if (state.lastMove && (state.lastMove.from === sq || state.lastMove.to === sq)) cls.push("last");
    if (state.selected === sq) cls.push("selected");
    if (state.targets.includes(sq)) cls.push("target", piece ? "capture" : "");
    if (inCheck && piece && piece.type === "k" && piece.color === turn) cls.push("check");
    if (canAct && piece && piece.color === turn) cls.push("movable");
    btn.className = cls.filter(Boolean).join(" ");

    let html = piece ? pieceHTML(piece.type, piece.color) : "";
    if (btn.dataset.edgeRank) html += `<span class="coord rank">${btn.dataset.edgeRank}</span>`;
    if (btn.dataset.edgeFile) html += `<span class="coord file">${btn.dataset.edgeFile}</span>`;
    btn.innerHTML = html;
    btn.setAttribute("aria-label", piece ? `${sq}, ${COLOR_NAME[piece.color].toLowerCase()} ${NAME[piece.type]}` : sq);
  }

  renderBars();
  renderClocks();
  renderStatus();
  renderMoves();
  el.undo.disabled = !canUndo();
  el.resign.disabled = !state.inGame || !!state.over;
}

function renderBars() {
  const bottomColor = state.orientation;
  const topColor = opposite(bottomColor);
  const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  const material = { w: 0, b: 0 };
  for (const row of game.board()) for (const p of row) {
    if (!p || p.type === "k") continue;
    counts[p.color][p.type]++;
    material[p.color] += VALUE[p.type];
  }
  const capturedBy = (color) => {
    const victim = opposite(color);
    let out = "";
    for (const t of ["q", "r", "b", "n", "p"]) {
      const lost = Math.max(0, START_COUNT[t] - counts[victim][t]);
      out += GLYPH[t][0].repeat(lost);
    }
    const adv = material[color] - material[victim];
    return out + (adv > 0 ? `<span class="adv">+${adv}</span>` : "");
  };
  el.top.name.textContent = playerName(topColor);
  el.bottom.name.textContent = playerName(bottomColor);
  el.top.cap.innerHTML = capturedBy(topColor);
  el.bottom.cap.innerHTML = capturedBy(bottomColor);
}

function renderClocks() {
  const bottomColor = state.orientation;
  for (const [bar, color] of [[el.bottom, bottomColor], [el.top, opposite(bottomColor)]]) {
    const ms = remaining(color);
    bar.clock.textContent = formatClock(ms);
    bar.clock.classList.toggle("active", state.clockRunning && !state.over && game.turn() === color);
    bar.clock.classList.toggle("low", state.inGame && ms < LOW_MS);
    bar.clock.setAttribute("aria-label", `${COLOR_NAME[color]} clock ${formatClock(ms)}`);
  }
}

function renderStatus() {
  let text, alert = false;
  if (!state.inGame) {
    text = "Choose your settings and press Start game.";
  } else if (state.over) {
    text = `${state.over.title}. ${state.over.reason}`;
  } else if (state.botThinking) {
    text = "Bot is thinking…";
  } else {
    const turn = game.turn();
    const who = state.mode === "bot" ? "Your move" : `${COLOR_NAME[turn]} to move`;
    alert = game.inCheck();
    text = alert ? `${who}: check!` : who;
  }
  el.status.textContent = text;
  el.status.classList.toggle("alert", alert);
}

function renderMoves() {
  const history = game.history();
  let html = "";
  for (let i = 0; i < history.length; i += 2) {
    const latestW = i === history.length - 1 ? " latest" : "";
    const latestB = i + 1 === history.length - 1 ? " latest" : "";
    html += `<li><span class="num">${i / 2 + 1}.</span><span class="mv${latestW}">${history[i]}</span>` +
      `<span class="mv${latestB}">${history[i + 1] ?? ""}</span></li>`;
  }
  el.moves.innerHTML = html;
  el.moves.scrollTop = el.moves.scrollHeight;
}

/* ---------- Moving ---------- */

function onBoardClick(e) {
  const btn = e.target.closest(".sq");
  if (!btn || !state.inGame || state.over || state.pendingPromo || state.botThinking || !isHumanTurn()) return;
  const sq = btn.dataset.square;
  const piece = game.get(sq);

  if (state.selected && state.targets.includes(sq)) {
    tryMove(state.selected, sq);
    return;
  }
  if (piece && piece.color === game.turn() && state.selected !== sq) {
    state.selected = sq;
    state.targets = game.moves({ square: sq, verbose: true }).map((m) => m.to);
  } else {
    state.selected = null;
    state.targets = [];
  }
  render();
}

function tryMove(from, to) {
  const options = game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (options.length === 0) return;
  if (options.some((m) => m.promotion)) {
    showPromotion(from, to, game.turn());
    return;
  }
  doMove({ from, to });
}

function showPromotion(from, to, color) {
  state.pendingPromo = { from, to };
  el.promoChoices.innerHTML = "";
  for (const t of ["q", "r", "b", "n"]) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = pieceHTML(t, color);
    b.setAttribute("aria-label", `Promote to ${NAME[t]}`);
    b.addEventListener("click", () => {
      el.promo.hidden = true;
      state.pendingPromo = null;
      doMove({ from, to, promotion: t });
    });
    el.promoChoices.appendChild(b);
  }
  el.promo.hidden = false;
  render();
  el.promoChoices.firstChild.focus();
}

function doMove(move) {
  const now = performance.now();
  const mover = game.turn();
  if (state.clockRunning) state.clocks[mover] -= now - state.turnStart;

  const result = game.move(move);
  state.lastMove = { from: result.from, to: result.to };
  state.selected = null;
  state.targets = [];
  // Clocks start once White has made the first move.
  if (!state.clockRunning && game.history().length >= 1) state.clockRunning = true;
  state.turnStart = now;

  checkGameOver();
  render();
  if (!state.over) maybeBotMove();
}

/* ---------- Game over ---------- */

function checkGameOver() {
  if (game.isCheckmate()) {
    const winner = opposite(game.turn());
    endGame(winTitle(winner), "Checkmate.");
  } else if (game.isStalemate()) {
    endGame("Draw", "Stalemate.");
  } else if (game.isThreefoldRepetition()) {
    endGame("Draw", "Same position three times.");
  } else if (game.isInsufficientMaterial()) {
    endGame("Draw", "Not enough pieces left to checkmate.");
  } else if (game.isDrawByFiftyMoves()) {
    endGame("Draw", "50 moves without a capture or pawn move.");
  }
}

function winTitle(winner) {
  if (state.mode === "bot") return winner === state.human ? "You win!" : "Bot wins";
  return `${COLOR_NAME[winner]} wins`;
}

function timeout(color) {
  state.clocks[color] = 0;
  const winner = opposite(color);
  if (cannotMate(winner)) {
    endGame("Draw", `${COLOR_NAME[color]} ran out of time, but ${COLOR_NAME[winner]} can't checkmate.`);
  } else {
    endGame(winTitle(winner), `${COLOR_NAME[color]} ran out of time.`);
  }
}

function endGame(title, reason) {
  if (state.clockRunning) {
    const side = game.turn();
    state.clocks[side] = Math.max(0, state.clocks[side] - (performance.now() - state.turnStart));
  }
  state.clockRunning = false;
  state.over = { title, reason };
  state.selected = null;
  state.targets = [];
  cancelBot();
  el.confirm.hidden = true;
  el.resultTitle.textContent = title;
  el.resultReason.textContent = reason;
  el.result.hidden = false;
  render();
}

/* ---------- Bot ---------- */

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("engine.js", import.meta.url), { type: "module" });
    worker.onmessage = onBotMessage;
    worker.onerror = () => {
      // If the worker can't run, play a random legal move so the game never stalls.
      const moves = game.moves({ verbose: true });
      const m = moves[Math.floor(Math.random() * moves.length)];
      onBotMessage({ data: { id: state.token, move: { from: m.from, to: m.to, promotion: m.promotion } } });
    };
  }
  return worker;
}

let botStarted = 0;

function maybeBotMove() {
  if (state.mode !== "bot" || state.over || !state.inGame || game.turn() === state.human) return;
  state.botThinking = true;
  state.token++;
  botStarted = performance.now();
  render();
  getWorker().postMessage({ id: state.token, fen: game.fen(), level: state.level, clockMs: remaining(game.turn()) });
}

function onBotMessage(e) {
  const { id, move } = e.data;
  if (id !== state.token || state.over || !move) return;
  const wait = BOT_MIN_DELAY[state.level] + Math.random() * 600 - (performance.now() - botStarted);
  setTimeout(() => {
    if (id !== state.token || state.over) return;
    state.botThinking = false;
    doMove(move);
  }, Math.max(0, wait));
}

function cancelBot() {
  state.token++;
  state.botThinking = false;
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

/* ---------- Controls ---------- */

function canUndo() {
  if (!state.inGame || state.over || state.pendingPromo) return false;
  const n = game.history().length;
  if (state.mode === "pvp") return n > 0;
  // vs bot: there must be a move of yours to take back
  return state.human === "w" ? n >= 1 : n >= 2;
}

function undo() {
  if (!canUndo()) return;
  const now = performance.now();
  if (state.clockRunning) state.clocks[game.turn()] -= now - state.turnStart;

  if (state.mode === "pvp") {
    game.undo();
  } else {
    cancelBot();
    game.undo();
    if (game.turn() !== state.human) game.undo();
  }
  const hist = game.history({ verbose: true });
  const last = hist[hist.length - 1];
  state.lastMove = last ? { from: last.from, to: last.to } : null;
  state.selected = null;
  state.targets = [];
  if (hist.length === 0) state.clockRunning = false;
  state.turnStart = now;
  render();
}

function flip() {
  state.orientation = opposite(state.orientation);
  assignSquares();
  render();
}

function askResign() {
  if (!state.inGame || state.over) return;
  const loser = state.mode === "bot" ? state.human : game.turn();
  el.confirmText.textContent = state.mode === "bot" ? "Resign this game?" : `Resign for ${COLOR_NAME[loser]}?`;
  el.confirm.hidden = false;
}

function resign() {
  const loser = state.mode === "bot" ? state.human : game.turn();
  endGame(winTitle(opposite(loser)), `${COLOR_NAME[loser]} resigned.`);
}

function readSetup() {
  state.mode = document.querySelector('input[name="mode"]:checked').value;
  state.level = document.querySelector('input[name="level"]:checked').value;
  state.colorChoice = document.querySelector('input[name="color"]:checked').value;
}

function syncSetupFields() {
  const pvp = document.querySelector('input[name="mode"]:checked').value === "pvp";
  el.levelField.hidden = pvp;
  el.colorField.hidden = pvp;
}

function startGame() {
  readSetup();
  cancelBot();
  game = new Chess();
  state.human = state.colorChoice === "random" ? (Math.random() < 0.5 ? "w" : "b") : state.colorChoice;
  state.orientation = state.mode === "bot" ? state.human : "w";
  Object.assign(state, {
    inGame: true, selected: null, targets: [], lastMove: null, over: null,
    clocks: { w: START_MS, b: START_MS }, clockRunning: false, turnStart: 0, pendingPromo: null,
  });
  el.result.hidden = true;
  el.promo.hidden = true;
  el.confirm.hidden = true;
  el.setup.hidden = true;
  el.gamePanel.hidden = false;
  assignSquares();
  render();
  maybeBotMove();
}

function openSetup() {
  cancelBot();
  state.inGame = false;
  state.clockRunning = false;
  state.over = null;
  state.pendingPromo = null;
  game = new Chess();
  Object.assign(state, { selected: null, targets: [], lastMove: null, clocks: { w: START_MS, b: START_MS } });
  el.result.hidden = true;
  el.promo.hidden = true;
  el.gamePanel.hidden = true;
  el.setup.hidden = false;
  render();
}

/* ---------- Clock tick ---------- */

function tick() {
  if (state.clockRunning && !state.over) {
    const side = game.turn();
    if (remaining(side) <= 0) {
      timeout(side);
      return;
    }
    renderClocks();
  }
}

/* ---------- Wire up ---------- */

buildBoard();
render();
el.board.addEventListener("click", onBoardClick);
$("btn-start").addEventListener("click", startGame);
$("btn-again").addEventListener("click", startGame);
$("btn-new").addEventListener("click", openSetup);
$("btn-undo").addEventListener("click", undo);
$("btn-flip").addEventListener("click", flip);
$("btn-resign").addEventListener("click", askResign);
$("btn-resign-yes").addEventListener("click", () => { el.confirm.hidden = true; resign(); });
$("btn-resign-no").addEventListener("click", () => { el.confirm.hidden = true; });
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", syncSetupFields));
syncSetupFields();
setInterval(tick, 100);
