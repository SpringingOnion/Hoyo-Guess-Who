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
  // A fresh game opens straight into choosing your character.
  const [sheet, setSheet] = useState<Sheet>(state.chosen === false ? 'secret' : null);
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

  const replay = () => {
    setState({ ...state, down: [], history: [], won: false, chosen: false, secret: pickSecret(state.board, state.secret) });
    setSheet('secret');
  };

  const chooseSecret = (id: string) => setState({ ...state, secret: id, chosen: true });

  const closeSecret = () => {
    // Closing without choosing keeps the random pick.
    if (state.chosen === false) setState({ ...state, chosen: true });
    setSheet(null);
  };

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
        <SecretSheet c={secret} chars={chars} startPicking={state.chosen === false}
          onClose={closeSecret} onChoose={chooseSecret}
          onRandom={() => chooseSecret(pickSecret(state.board, state.secret))} />
      )}
      {sheet === 'guess' && (
        <GuessSheet chars={up} onClose={() => setSheet(null)}
          onWrong={(id) => { commit([...state.down, id]); setSheet(null); }}
          onRight={() => { setState({ ...state, won: true }); setSheet(null); }} />
      )}
      {sheet === 'menu' && (
        <Modal onClose={() => setSheet(null)}>
          <div className="menu">
            <button className="btn wide" onClick={replay}>Play again, same board</button>
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
            <button className="btn wide primary" onClick={replay}>Play again, same board</button>
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

/** Searchable grid of characters. */
function CharacterPicker({ chars, selected, onPick }: { chars: Character[]; selected?: string; onPick: (c: Character) => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? chars.filter((c) => c.name.toLowerCase().includes(q)) : chars;
  return (
    <>
      {chars.length > 12 && (
        <input
          className="search"
          type="search"
          placeholder={`Search ${chars.length} characters`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && shown.length === 1 && onPick(shown[0])}
          autoCorrect="off"
          spellCheck={false}
        />
      )}
      <div className={`pick-grid ${chars.length > 30 ? 'dense' : ''}`}>
        {shown.map((c) => (
          <button key={c.id} className={`card ${c.id === selected ? 'selected' : ''}`} onClick={() => onPick(c)}>
            <img src={BASE + c.img} alt="" loading="lazy" />
            <span className="name">{c.name}</span>
          </button>
        ))}
        {!shown.length && <p className="muted small empty">No one called “{query}”.</p>}
      </div>
    </>
  );
}

function SecretSheet({ c, chars, startPicking, onClose, onChoose, onRandom }: {
  c: Character; chars: Character[]; startPicking: boolean;
  onClose: () => void; onChoose: (id: string) => void; onRandom: () => void;
}) {
  const [mode, setMode] = useState<'hidden' | 'shown' | 'pick'>(startPicking ? 'pick' : 'hidden');
  return (
    <Modal onClose={onClose}>
      {mode === 'pick' ? (
        <>
          <h2>Choose your character</h2>
          <div className="pick-actions">
            <button className="btn" onClick={() => { onRandom(); setMode('shown'); }}>🎲 Random</button>
            {!startPicking && <button className="btn subtle" onClick={() => setMode('shown')}>Cancel</button>}
          </div>
          <CharacterPicker chars={chars} selected={startPicking ? undefined : c.id} onPick={(p) => { onChoose(p.id); setMode('shown'); }} />
        </>
      ) : mode === 'hidden' ? (
        <>
          <h2>Your secret character</h2>
          <p className="muted">Make sure your opponent can't see your screen.</p>
          <button className="btn wide primary" onClick={() => setMode('shown')}>Reveal</button>
        </>
      ) : (
        <>
          <h2>Your secret character</h2>
          <CharacterBadge c={c} />
          <div className="pick-actions">
            <button className="btn" onClick={() => setMode('pick')}>Change</button>
            <button className="btn" onClick={onRandom}>🎲 Random</button>
          </div>
          <button className="btn wide primary" onClick={onClose}>Done</button>
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
          <CharacterPicker chars={chars} onPick={setPick} />
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
