// Code Hashira chess bot. Runs as a module Web Worker so the board never freezes.
// Uses chess.js for legal move generation (its fast internal API, pinned in ./vendor)
// and a small alpha-beta search with piece-square tables on top.
import { Chess } from "./vendor/chess.js";

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;

// Piece-square tables from White's point of view, a8..h8 first (row 0 = rank 8).
// Based on the widely used "simplified evaluation function" values.
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
  kEnd: [
    -50,-40,-30,-20,-20,-30,-40,-50,
    -30,-20,-10,  0,  0,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50,
  ],
};

// chess.js uses a 0x88 board: index = row * 16 + file, row 0 = rank 8.
const toAlg = (sq) => "abcdefgh"[sq & 7] + (8 - (sq >> 4));

class StopSearch extends Error {}

// Static evaluation from the side to move's point of view.
function evaluate(game, materialOnly) {
  const board = game._board;
  let score = 0;
  let nonPawn = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = board[sq];
    if (p && p.type !== "p" && p.type !== "k") nonPawn += VALUE[p.type];
  }
  const endgame = nonPawn <= 1300;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = board[sq];
    if (!p) continue;
    let v = VALUE[p.type];
    if (!materialOnly) {
      const row = sq >> 4;
      const idx = (p.color === "w" ? row : 7 - row) * 8 + (sq & 7);
      const table = p.type === "k" && endgame ? PST.kEnd : PST[p.type];
      v += table[idx];
    }
    score += p.color === "w" ? v : -v;
  }
  return game._turn === "w" ? score : -score;
}

// Captures first, most valuable victim / least valuable attacker; promotions too.
function orderScore(m) {
  let s = 0;
  if (m.captured) s += 10 * VALUE[m.captured] - VALUE[m.piece] + 1000;
  if (m.promotion) s += VALUE[m.promotion] + 900;
  return s;
}

function orderedMoves(game, capturesOnly, first) {
  let moves = game._moves({ legal: true });
  if (capturesOnly) moves = moves.filter((m) => m.captured || m.promotion);
  moves.sort((a, b) => orderScore(b) - orderScore(a));
  if (first) {
    const i = moves.findIndex((m) => m.from === first.from && m.to === first.to && m.promotion === first.promotion);
    if (i > 0) moves.unshift(moves.splice(i, 1)[0]);
  }
  return moves;
}

function makeSearcher({ deadline, materialOnly, useQuiescence }) {
  let nodes = 0;

  function quiesce(game, alpha, beta, depth) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new StopSearch();
    const stand = evaluate(game, materialOnly);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (depth <= 0) return stand;
    for (const m of orderedMoves(game, true)) {
      game._makeMove(m);
      const score = -quiesce(game, -beta, -alpha, depth - 1);
      game._undoMove();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(game, depth, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new StopSearch();
    const moves = orderedMoves(game, false);
    if (moves.length === 0) {
      return game._isKingAttacked(game._turn) ? -MATE + ply : 0;
    }
    if (depth === 0) {
      return useQuiescence ? quiesce(game, alpha, beta, 6) : evaluate(game, materialOnly);
    }
    let best = -Infinity;
    for (const m of moves) {
      game._makeMove(m);
      const score = -negamax(game, depth - 1, -beta, -alpha, ply + 1);
      game._undoMove();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Scores every root move (full window) so the caller can add randomness.
  function rootScores(game, depth, pvFirst) {
    const results = [];
    for (const m of orderedMoves(game, false, pvFirst)) {
      game._makeMove(m);
      const score = -negamax(game, depth - 1, -MATE - 1, MATE + 1, 1);
      game._undoMove();
      results.push({ move: m, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  return { rootScores };
}

const LEVELS = {
  // Looks one move ahead at material only, with lots of noise: blunders often.
  easy:   { minDepth: 1, maxDepth: 1, materialOnly: true,  useQuiescence: false, noise: 220, randomChance: 0.25, maxTime: 400 },
  // Two moves ahead plus capture checks, small noise: solid but beatable.
  medium: { minDepth: 2, maxDepth: 2, materialOnly: false, useQuiescence: true,  noise: 40,  randomChance: 0,    maxTime: 1500 },
  // Iterative deepening as far as time allows, no noise.
  master: { minDepth: 1, maxDepth: 8, materialOnly: false, useQuiescence: true,  noise: 0,   randomChance: 0,    maxTime: 3500 },
};

export function chooseMove(fen, levelName, clockMs) {
  const level = LEVELS[levelName] || LEVELS.medium;
  const game = new Chess(fen);
  const legal = game._moves({ legal: true });
  if (legal.length === 0) return null;
  if (legal.length === 1) return toResult(legal[0]);

  if (Math.random() < level.randomChance) {
    return toResult(legal[Math.floor(Math.random() * legal.length)]);
  }

  // Spend a small slice of the remaining clock, never more than the level allows.
  // Openings get less time: the first few moves don't need deep thought.
  const moveNumber = Number(fen.split(" ")[5]) || 1;
  const cap = moveNumber <= 4 ? Math.min(level.maxTime, 1200) : level.maxTime;
  const budget = Math.max(150, Math.min(cap, (clockMs ?? 240000) / 30));
  const deadline = Date.now() + budget;
  const searcher = makeSearcher({ deadline, materialOnly: level.materialOnly, useQuiescence: level.useQuiescence });

  let scored = null;
  for (let depth = level.minDepth; depth <= level.maxDepth; depth++) {
    try {
      scored = searcher.rootScores(game, depth, scored && scored[0].move);
    } catch (e) {
      if (!(e instanceof StopSearch)) throw e;
      if (!scored) {
        // Ran out of time before finishing even the first depth: fall back to a quick pick.
        scored = legal.map((m) => ({ move: m, score: orderScore(m) }));
        scored.sort((a, b) => b.score - a.score);
      }
      break;
    }
    if (Math.abs(scored[0].score) > MATE - 100) break; // found a forced mate
  }

  let pick = scored[0];
  if (level.noise > 0) {
    let bestNoisy = -Infinity;
    for (const r of scored) {
      const noisy = r.score + (Math.random() * 2 - 1) * level.noise;
      if (noisy > bestNoisy) { bestNoisy = noisy; pick = r; }
    }
  } else {
    // Vary the master's play a little among equally good moves.
    const ties = scored.filter((r) => r.score >= scored[0].score - 8);
    pick = ties[Math.floor(Math.random() * ties.length)];
  }
  return toResult(pick.move);
}

function toResult(m) {
  return { from: toAlg(m.from), to: toAlg(m.to), promotion: m.promotion };
}

if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof window === "undefined") {
  self.onmessage = (e) => {
    const { id, fen, level, clockMs } = e.data;
    const move = chooseMove(fen, level, clockMs);
    self.postMessage({ id, move });
  };
}
