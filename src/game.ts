import rosterJson from './data/roster.json';

export type GameId = 'gi' | 'hsr' | 'zzz';

export interface Character {
  id: string;
  name: string;
  rarity: number;
  attrs: Record<string, string>;
  img: string;
}

export interface GameInfo {
  id: GameId;
  name: string;
  letter: string;
}

export const ROSTER = rosterJson as unknown as Record<GameId, Character[]>;

export const GAMES: Record<GameId, GameInfo> = {
  gi: {
    id: 'gi', name: 'Genshin Impact', letter: 'G',
  },
  hsr: {
    id: 'hsr', name: 'Honkai: Star Rail', letter: 'S',
  },
  zzz: {
    id: 'zzz', name: 'Zenless Zone Zero', letter: 'Z',
  },
};

export const GAME_IDS: GameId[] = ['gi', 'hsr', 'zzz'];
export const SIZES = [16, 20, 24, 30];

const byId = new Map<string, Character>();
for (const g of GAME_IDS) for (const c of ROSTER[g]) byId.set(c.id, c);
export const charById = (id: string) => byId.get(id);

// ------------------------------------------------------------- seeded RNG
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same code => same board on every phone (as long as both run the same app version). */
export function boardFor(game: GameId, size: number, seed: string): string[] {
  const ids = ROSTER[game].map((c) => c.id).sort();
  const rand = mulberry32(hash(`${game}:${size}:${seed}`));
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, Math.min(size, ids.length));
}

// ------------------------------------------------------------- room codes
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeCode(game: GameId, size: number): string {
  let seed = '';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  for (const b of bytes) seed += ALPHABET[b % ALPHABET.length];
  return `${GAMES[game].letter}${size}-${seed}`;
}

export function parseCode(raw: string): { game: GameId; size: number; seed: string } | null {
  const m = raw.trim().toUpperCase().replace(/\s/g, '').match(/^([GSZ])(\d{2})-?([A-Z0-9]{4})$/);
  if (!m) return null;
  const game = GAME_IDS.find((g) => GAMES[g].letter === m[1])!;
  const size = Number(m[2]);
  if (!SIZES.includes(size)) return null;
  return { game, size, seed: m[3] };
}

// ------------------------------------------------------------- game state
export interface GameState {
  game: GameId;
  size: number;
  code: string;
  board: string[];
  down: string[];
  secret: string;
  history: string[][];
  won?: boolean;
}

export function pickSecret(board: string[], avoid?: string): string {
  const pool = board.length > 1 && avoid ? board.filter((id) => id !== avoid) : board;
  return pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length];
}

export function newGame(code: string): GameState | null {
  const p = parseCode(code);
  if (!p) return null;
  const board = boardFor(p.game, p.size, p.seed);
  return { game: p.game, size: p.size, code: `${GAMES[p.game].letter}${p.size}-${p.seed}`, board, down: [], secret: pickSecret(board), history: [] };
}

const KEY = 'hgw:game';
export function loadGame(): GameState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as GameState | null;
    return s && s.board.every((id) => charById(id)) ? s : null;
  } catch {
    return null;
  }
}
export function saveGame(s: GameState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable – game just won't survive a reload */
  }
}
