import { useMemo, useState } from 'react';
import {
  GAMES, GAME_IDS, GameId, GameState, Filters, MIN_POOL, ROSTER,
  filterGroups, loadFilters, poolFor, saveFilters,
} from './game';
import UpdateButton from './UpdateButton';
import meta from './data/meta.json';

const BASE = import.meta.env.BASE_URL;

interface Props {
  saved: GameState | null;
  onStart: (game: GameId, filters: Filters) => void;
  onResume: () => void;
}

// A few recognisable faces for each game tile.
const COVER: Record<GameId, string[]> = {
  gi: ['Lumine', 'Raiden Shogun', 'Zhongli'],
  hsr: ['Stelle', 'Kafka', 'Dan Heng'],
  zzz: ['Anby', 'Ellen', 'Miyabi'],
};

export default function Home({ saved, onStart, onResume }: Props) {
  const [game, setGame] = useState<GameId>(saved?.game ?? 'gi');
  const [allFilters, setAllFilters] = useState(loadFilters);
  const [showFilters, setShowFilters] = useState(false);

  const filters = allFilters[game] ?? {};
  const pool = useMemo(() => poolFor(game, filters), [game, filters]);
  const filtered = pool.length < ROSTER[game].length;

  const setFilters = (f: Filters) => {
    const next = { ...allFilters, [game]: f };
    setAllFilters(next);
    saveFilters(next);
  };

  const toggle = (key: string, value: string) => {
    const ex = filters[key] ?? [];
    const nextEx = ex.includes(value) ? ex.filter((v) => v !== value) : [...ex, value];
    const next = { ...filters, [key]: nextEx };
    if (!nextEx.length) delete next[key];
    setFilters(next);
  };

  const only = (key: string, value: string) => {
    const group = filterGroups(game).find((g) => g.key === key)!;
    setFilters({ ...filters, [key]: group.values.filter((v) => v !== value) });
  };

  return (
    <div className="home" data-game={game}>
      <header className="home-head">
        <h1>Hoyo Guess Who</h1>
        <p>Pick a game and both players get every character on the board. Each phone picks its own secret character.</p>
      </header>

      {saved && !saved.won && (
        <button className="btn wide resume" onClick={onResume}>
          Resume {GAMES[saved.game].name}{saved.filtered ? ' (filtered)' : ''}
        </button>
      )}

      <section>
        <h2>1. Pick a game</h2>
        <div className="game-tiles">
          {GAME_IDS.map((g) => {
            const faces = ROSTER[g].filter((c) => COVER[g].includes(c.name)).slice(0, 3);
            const shown = faces.length ? faces : ROSTER[g].slice(0, 3);
            return (
              <button key={g} className={`tile ${game === g ? 'on' : ''}`} data-game={g} onClick={() => setGame(g)}>
                <span className="faces">
                  {shown.map((c) => <img key={c.id} src={BASE + c.img} alt="" />)}
                </span>
                <span className="tile-name">{GAMES[g].name}</span>
                <span className="tile-count">{ROSTER[g].length} characters</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="filter-head">
          <h2>2. Filters (optional)</h2>
          {filtered && <button className="link" onClick={() => setFilters({})}>Reset</button>}
        </div>
        <button className={`filter-summary ${filtered ? 'active' : ''}`} onClick={() => setShowFilters((v) => !v)}>
          <span>
            {filtered ? `${pool.length} of ${ROSTER[game].length} characters` : `All ${ROSTER[game].length} characters`}
          </span>
          <span className="chev">{showFilters ? '▴' : '▾'}</span>
        </button>
        {showFilters && (
          <div className="filters">
            <p className="hint">Tap to include or exclude. Long-press to pick only that one.</p>
            {filterGroups(game).map((g) => (
              <div key={g.key} className="filter-group">
                <h3>{g.label}</h3>
                <div className="chips">
                  {g.values.map((v) => {
                    const on = !filters[g.key]?.includes(v);
                    return (
                      <button
                        key={v}
                        className={on ? 'on' : ''}
                        onClick={() => toggle(g.key, v)}
                        onContextMenu={(e) => { e.preventDefault(); only(g.key, v); }}
                      >{v}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {pool.length < MIN_POOL && <p className="hint warn">Too few characters match. Loosen the filters.</p>}
      </section>

      <button className="btn wide primary" disabled={pool.length < MIN_POOL} onClick={() => onStart(game, filters)}>
        Start game · {pool.length} characters
      </button>

      <footer className="credits">
        <UpdateButton />
        <div>Characters updated {meta.updated}</div>
        <div>Fan-made, non-commercial. Character art © HoYoverse.</div>
      </footer>
    </div>
  );
}
