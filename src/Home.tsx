import { useState } from 'react';
import { GAMES, GAME_IDS, GameId, ROSTER, SIZES, makeCode, parseCode, GameState } from './game';

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
  const [code, setCode] = useState('');
  const parsed = parseCode(code);

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

      <button className="btn wide primary" onClick={() => onStart(makeCode(game, size))}>
        Start new game
      </button>

      <section className="join">
        <h2>…or join a friend's game</h2>
        <div className="join-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="G24-K7QX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={9}
          />
          <button className="btn" disabled={!parsed} onClick={() => parsed && onStart(code)}>Join</button>
        </div>
        {code && !parsed && <p className="hint">Codes look like G24-K7QX (letter = game, number = board size).</p>}
        {parsed && <p className="hint">{GAMES[parsed.game].name} · {parsed.size} characters</p>}
      </section>

      <footer className="credits">
        Fan-made, non-commercial. Character art © HoYoverse.
      </footer>
    </div>
  );
}
