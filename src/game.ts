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
  /** [attribute key, label] pairs that can be filtered on */
  filters: [string, string][];
  rarity: (r: number) => string;
}

export const ROSTER = rosterJson as unknown as Record<GameId, Character[]>;

const stars = (r: number) => `${r}★`;

export const GAMES: Record<GameId, GameInfo> = {
  gi: {
    id: 'gi', name: 'Genshin Impact', letter: 'G', rarity: stars,
    filters: [['rarity', 'Rarity'], ['element', 'Element'], ['weapon', 'Weapon'], ['region', 'Region'], ['gender', 'Gender']],
  },
  hsr: {
    id: 'hsr', name: 'Honkai: Star Rail', letter: 'S', rarity: stars,
    filters: [['rarity', 'Rarity'], ['element', 'Type'], ['path', 'Path'], ['gender', 'Gender']],
  },
  zzz: {
    id: 'zzz', name: 'Zenless Zone Zero', letter: 'Z', rarity: (r) => (r >= 5 ? 'S-Rank' : 'A-Rank'),
    filters: [['rarity', 'Rank'], ['element', 'Attribute'], ['specialty', 'Specialty'], ['gender', 'Gender']],
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

// ------------------------------------------------------------- filters
/** Excluded values per attribute key. Characters with no value for a key always pass. */
export type Filters = Record<string, string[]>;

export function valueOf(game: GameId, c: Character, key: string): string | undefined {
  return key === 'rarity' ? GAMES[game].rarity(c.rarity) : c.attrs[key];
}

export interface FilterGroup { key: string; label: string; values: string[] }

const groupCache = new Map<GameId, FilterGroup[]>();
/** Every filterable value for a game, in a fixed order (this order is what codes encode). */
export function filterGroups(game: GameId): FilterGroup[] {
  if (!groupCache.has(game)) {
    groupCache.set(game, GAMES[game].filters.map(([key, label]) => {
      const values = [...new Set(ROSTER[game].map((c) => valueOf(game, c, key)).filter((v): v is string => !!v))];
      values.sort(key === 'rarity' ? (x, y) => y.localeCompare(x) : (x, y) => x.localeCompare(y));
      return { key, label, values };
    }));
  }
  return groupCache.get(game)!;
}

export function poolFor(game: GameId, filters: Filters): Character[] {
  return ROSTER[game].filter((c) =>
    Object.entries(filters).every(([key, excluded]) => {
      const v = valueOf(game, c, key);
      return v === undefined || !excluded.includes(v);
    }));
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Filters -> short base-32 string ('' when nothing is filtered out). */
export function encodeFilters(game: GameId, filters: Filters): string {
  let bits = 0n, i = 0n;
  for (const g of filterGroups(game)) for (const v of g.values) {
    if (filters[g.key]?.includes(v)) bits |= 1n << i;
    i++;
  }
  let out = '';
  while (bits > 0n) { out = ALPHABET[Number(bits & 31n)] + out; bits >>= 5n; }
  return out;
}

export function decodeFilters(game: GameId, code: string): Filters {
  let bits = 0n;
  for (const ch of code) bits = (bits << 5n) | BigInt(ALPHABET.indexOf(ch));
  const filters: Filters = {};
  let i = 0n;
  for (const g of filterGroups(game)) for (const v of g.values) {
    if (bits & (1n << i)) (filters[g.key] ??= []).push(v);
    i++;
  }
  return filters;
}

/** One character fingerprint of a game's character list, so mismatched app versions can be detected. */
export function rosterVersion(game: GameId): string {
  return ALPHABET[hash(ROSTER[game].map((c) => c.id).sort().join()) % ALPHABET.length];
}

/** Same code => same board on every phone (as long as both run the same app version). */
export function boardFor(game: GameId, size: number, seed: string, filterCode = ''): string[] {
  const ids = poolFor(game, decodeFilters(game, filterCode)).map((c) => c.id).sort();
  const rand = mulberry32(hash(`${game}:${size}:${seed}${filterCode ? ':' + filterCode : ''}`));
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, Math.min(size, ids.length));
}

// ------------------------------------------------------------- room codes
// Format: G24-K7QXV[-FILTER]
//   G = game letter, 24 = board size, K7QX = random seed, V = character-list version,
//   FILTER = optional excluded-filters bitmask.
export const MIN_POOL = 4;

export function makeCode(game: GameId, size: number, filters: Filters): string {
  let seed = '';
  for (const b of crypto.getRandomValues(new Uint8Array(4))) seed += ALPHABET[b % ALPHABET.length];
  const f = encodeFilters(game, filters);
  return `${GAMES[game].letter}${size}-${seed}${rosterVersion(game)}${f ? '-' + f : ''}`;
}

export interface ParsedCode {
  game: GameId; size: number; seed: string; filterCode: string;
  /** false when the code was made by an app with a different character list */
  sameVersion: boolean;
  code: string;
}

export function parseCode(raw: string): ParsedCode | null {
  const m = raw.trim().toUpperCase().replace(/\s/g, '').match(/^([GSZ])(\d{2})-?([A-HJ-NP-Z2-9]{4})([A-HJ-NP-Z2-9])?(?:-([A-HJ-NP-Z2-9]{1,8}))?$/);
  if (!m) return null;
  const game = GAME_IDS.find((g) => GAMES[g].letter === m[1])!;
  const size = Number(m[2]);
  if (!SIZES.includes(size)) return null;
  const [, letter, , seed, ver = '', filterCode = ''] = m;
  return {
    game, size, seed, filterCode,
    sameVersion: !ver || ver === rosterVersion(game),
    code: `${letter}${size}-${seed}${ver}${filterCode ? '-' + filterCode : ''}`,
  };
}

const FILTER_KEY = 'hgw:filters';
export function loadFilters(): Partial<Record<GameId, Filters>> {
  try { return JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}'); } catch { return {}; }
}
export function saveFilters(f: Partial<Record<GameId, Filters>>) {
  try { localStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* ignore */ }
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
  const board = boardFor(p.game, p.size, p.seed, p.filterCode);
  if (board.length < 2) return null;
  return { game: p.game, size: p.size, code: p.code, board, down: [], secret: pickSecret(board), history: [] };
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
