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
  /** [attribute key, label] pairs that can be filtered on */
  filters: [string, string][];
  rarity: (r: number) => string;
}

export const ROSTER = rosterJson as unknown as Record<GameId, Character[]>;

const stars = (r: number) => `${r}★`;

export const GAMES: Record<GameId, GameInfo> = {
  gi: {
    id: 'gi', name: 'Genshin Impact', rarity: stars,
    filters: [['rarity', 'Rarity'], ['element', 'Element'], ['weapon', 'Weapon'], ['region', 'Region'], ['gender', 'Gender']],
  },
  hsr: {
    id: 'hsr', name: 'Honkai: Star Rail', rarity: stars,
    filters: [['rarity', 'Rarity'], ['element', 'Type'], ['path', 'Path'], ['gender', 'Gender']],
  },
  zzz: {
    id: 'zzz', name: 'Zenless Zone Zero', rarity: (r) => (r >= 5 ? 'S-Rank' : 'A-Rank'),
    filters: [['rarity', 'Rank'], ['element', 'Attribute'], ['specialty', 'Specialty'], ['gender', 'Gender']],
  },
};

export const GAME_IDS: GameId[] = ['gi', 'hsr', 'zzz'];
export const MIN_POOL = 2;

const byId = new Map<string, Character>();
for (const g of GAME_IDS) for (const c of ROSTER[g]) byId.set(c.id, c);
export const charById = (id: string) => byId.get(id);

// ------------------------------------------------------------- filters
/** Excluded values per attribute key. Characters with no value for a key always pass. */
export type Filters = Record<string, string[]>;

export function valueOf(game: GameId, c: Character, key: string): string | undefined {
  return key === 'rarity' ? GAMES[game].rarity(c.rarity) : c.attrs[key];
}

export interface FilterGroup { key: string; label: string; values: string[] }

const groupCache = new Map<GameId, FilterGroup[]>();
/** Every filterable value for a game, in display order. */
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

/** Characters on the board: everyone in the game, minus anything filtered out. Sorted by name. */
export function poolFor(game: GameId, filters: Filters): Character[] {
  return ROSTER[game].filter((c) =>
    Object.entries(filters).every(([key, excluded]) => {
      const v = valueOf(game, c, key);
      return v === undefined || !excluded.includes(v);
    }));
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
  filtered: boolean;
  board: string[];
  down: string[];
  secret: string;
  history: string[][];
  won?: boolean;
  /** false until the player has chosen (or accepted a random) secret character */
  chosen?: boolean;
}

export function pickSecret(board: string[], avoid?: string): string {
  const pool = board.length > 1 && avoid ? board.filter((id) => id !== avoid) : board;
  return pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length];
}

export function newGame(game: GameId, filters: Filters): GameState | null {
  const pool = poolFor(game, filters);
  if (pool.length < MIN_POOL) return null;
  const board = pool.map((c) => c.id);
  return { game, filtered: board.length < ROSTER[game].length, board, down: [], secret: pickSecret(board), history: [], chosen: false };
}

const KEY = 'hgw:game';
export function loadGame(): GameState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as GameState | null;
    // Drop saves from older versions (they had room codes) or with characters that no longer exist.
    return s && !('code' in s) && s.board.every((id) => charById(id)) ? s : null;
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
