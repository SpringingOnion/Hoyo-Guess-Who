import { useEffect, useMemo, useState } from 'react';
import { GAMES, GameState, charById, Character, pickSecret } from './game';

const BASE = import.meta.env.BASE_URL;

interface Props {
  state: GameState;
  setState: (s: GameState) => void;
  onHome: () => void;
  onNewGame: () => void;
}

type Sheet = null | 'secret' | 'guess' | 'menu';

export default function Board({ state, setState, onHome, onNewGame }: Props) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const info = GAMES[state.game];
  const chars = useMemo(() => state.board.map((id) => charById(id)!).filter(Boolean), [state.board]);
  const down = useMemo(() => new Set(state.down), [state.down]);
  const secret = charById(state.secret)!;
  const up = chars.filter((c) => !down.has(c.id));

  useWakeLock();

  const commit = (nextDown: string[], extra: Partial<GameState> = {}) =>
    setState({ ...state, down: nextDown, history: [...state.history, state.down].slice(-60), ...extra });

  const toggle = (id: string) =>
    commit(down.has(id) ? state.down.filter((d) => d !== id) : [...state.down, id]);

  const undo = () => {
    if (!state.history.length) return;
    setState({ ...state, down: state.history[state.history.length - 1], history: state.history.slice(0, -1) });
  };

  const replay = (newSecret = true) =>
    setState({ ...state, down: [], history: [], won: false, secret: newSecret ? pickSecret(state.board, state.secret) : state.secret });

  return (
    <div className="board" data-game={state.game}>
      <header className="bar top">
        <button className="icon-btn" onClick={onHome} aria-label="Home">‹</button>
        <div className="title">
          <strong>{info.name}{state.filtered ? ' · filtered' : ''}</strong>
          <span>{up.length} of {chars.length} left</span>
        </div>
        <button className="icon-btn" onClick={() => setSheet('menu')} aria-label="Menu">⋮</button>
      </header>

      <main className={`grid ${chars.length > 30 ? 'dense' : ''}`}>
        {chars.map((c) => (
          <button key={c.id} className={`card ${down.has(c.id) ? 'down' : ''}`} onClick={() => toggle(c.id)}>
            <img src={BASE + c.img} alt="" loading="lazy" draggable={false} />
            <span className="name">{c.name}</span>
          </button>
        ))}
      </main>

      <nav className="bar bottom">
        <button className="secret-btn" onClick={() => setSheet('secret')}>
          <span className="mini-q">?</span>
          My character
        </button>
        <button onClick={undo} disabled={!state.history.length}>Undo</button>
        <button className="accent" onClick={() => setSheet('guess')}>Guess</button>
      </nav>

      {sheet === 'secret' && (
        <SecretSheet c={secret} state={state} onClose={() => setSheet(null)}
          onReroll={() => replay(true)} />
      )}
      {sheet === 'guess' && (
        <GuessSheet chars={up} onClose={() => setSheet(null)}
          onWrong={(id) => { commit([...state.down, id]); setSheet(null); }}
          onRight={() => { setState({ ...state, won: true }); setSheet(null); }} />
      )}
      {sheet === 'menu' && (
        <Modal onClose={() => setSheet(null)}>
          <div className="menu">
            <button className="btn wide" onClick={() => { replay(true); setSheet(null); }}>Play again, same board</button>
            <button className="btn wide" onClick={() => { commit([]); setSheet(null); }}>Flip all cards back up</button>
            <button className="btn wide" onClick={onNewGame}>New game</button>
          </div>
        </Modal>
      )}
      {state.won && (
        <Modal onClose={() => setState({ ...state, won: false })}>
          <div className="win">
            <div className="confetti">🎉</div>
            <h2>You got it!</h2>
            <p className="muted">Your character was</p>
            <CharacterBadge c={secret} />
            <button className="btn wide primary" onClick={() => replay(true)}>Play again, same board</button>
            <button className="btn wide" onClick={onNewGame}>New game</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ sheets

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="Close">×</button>
        {children}
      </div>
    </div>
  );
}

function CharacterBadge({ c }: { c: Character }) {
  return (
    <div className="badge">
      <img src={BASE + c.img} alt="" />
      <strong>{c.name}</strong>
    </div>
  );
}

function SecretSheet({ c, state, onClose, onReroll }: { c: Character; state: GameState; onClose: () => void; onReroll: () => void }) {
  const [shown, setShown] = useState(false);
  return (
    <Modal onClose={onClose}>
      <h2>Your secret character</h2>
      {!shown ? (
        <>
          <p className="muted">Make sure your opponent can't see your screen.</p>
          <button className="btn wide primary" onClick={() => setShown(true)}>Reveal</button>
        </>
      ) : (
        <>
          <CharacterBadge c={c} />
          {!state.down.length && (
            <button className="btn wide subtle" onClick={onReroll}>Pick a different character</button>
          )}
        </>
      )}
    </Modal>
  );
}

function GuessSheet({ chars, onClose, onWrong, onRight }: {
  chars: Character[]; onClose: () => void; onWrong: (id: string) => void; onRight: () => void;
}) {
  const [pick, setPick] = useState<Character | null>(chars.length === 1 ? chars[0] : null);
  return (
    <Modal onClose={onClose}>
      {!pick ? (
        <>
          <h2>Who is it?</h2>
          <div className="pick-grid">
            {chars.map((c) => (
              <button key={c.id} className="card" onClick={() => setPick(c)}>
                <img src={BASE + c.img} alt="" />
                <span className="name">{c.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="guess">
          <p className="muted">Show this to your opponent:</p>
          <h2>Is it…</h2>
          <CharacterBadge c={pick} />
          <div className="answer-row">
            <button className="btn yes" onClick={onRight}>Yes!</button>
            <button className="btn no" onClick={() => onWrong(pick.id)}>No</button>
          </div>
          <button className="btn wide subtle" onClick={() => setPick(null)}>Pick someone else</button>
        </div>
      )}
    </Modal>
  );
}

// Keep the screen on while a game is open.
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
      } catch { /* not supported or denied */ }
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      lock?.release().catch(() => {});
    };
  }, []);
}
