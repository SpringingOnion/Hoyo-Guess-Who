import { useMemo, useState } from 'react';
import {
  GAMES, GAME_IDS, GameId, GameState, Filters, MIN_POOL, ROSTER, SIZES,
  decodeFilters, filterGroups, loadFilters, makeCode, parseCode, poolFor, saveFilters,
} from './game';
import UpdateButton from './UpdateButton';
import meta from './data/meta.json';

const BASE = import.meta.env.BASE_URL;

interface Props {
  saved: GameState | null;
  onStart: (code: string) => void;
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
  const [size, setSize] = useState(saved?.size ?? 24);
  const [allFilters, setAllFilters] = useState(loadFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [code, setCode] = useState('');

  const filters = allFilters[game] ?? {};
  const pool = useMemo(() => poolFor(game, filters), [game, filters]);
  const filtered = pool.length < ROSTER[game].length;
  const parsed = parseCode(code);
  const joinPool = parsed ? poolFor(parsed.game, decodeFilters(parsed.game, parsed.filterCode)).length : 0;

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
        <p>Both players open the same board. Each phone gets its own secret character.</p>
      </header>

      {saved && !saved.won && (
        <button className="btn wide resume" onClick={onResume}>
          Resume {GAMES[saved.game].name} · <span className="mono">{saved.code}</span>
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
        <h2>2. Board size</h2>
        <div className="seg">
          {SIZES.map((s) => (
            <button key={s} className={size === s ? 'on' : ''} onClick={() => setSize(s)}>{s}</button>
          ))}
        </div>
      </section>

      <section>
        <div className="filter-head">
          <h2>3. Filters</h2>
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
        {pool.length < MIN_POOL ? (
          <p className="hint warn">Too few characters match. Loosen the filters.</p>
        ) : pool.length < size ? (
          <p className="hint">Only {pool.length} characters match, so the board will have {pool.length}.</p>
        ) : null}
      </section>

      <button className="btn wide primary" disabled={pool.length < MIN_POOL} onClick={() => onStart(makeCode(game, size, filters))}>
        Start new game
      </button>

      <section className="join">
        <h2>…or join a friend's game</h2>
        <div className="join-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="G24-K7QXA"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
          />
          <button className="btn" disabled={!parsed || joinPool < 2} onClick={() => parsed && onStart(code)}>Join</button>
        </div>
        {code && !parsed && <p className="hint">Enter the code shown at the top of your friend's board, for example G24-K7QXA.</p>}
        {parsed && (
          <p className="hint">
            {GAMES[parsed.game].name} · {Math.min(parsed.size, joinPool)} characters{parsed.filterCode ? ' · filtered' : ''}
          </p>
        )}
        {parsed && !parsed.sameVersion && (
          <p className="hint warn">
            This code came from a version of the app with a different character list, so your boards won't match.
            Both of you: tap <b>Check for updates</b> below, then start a new game.
          </p>
        )}
      </section>

      <footer className="credits">
        <UpdateButton />
        <div>Characters updated {meta.updated}</div>
        <div>Fan-made, non-commercial. Character art © HoYoverse.</div>
      </footer>
    </div>
  );
}
