import { useEffect, useMemo, useState } from 'react';
import { GAMES, GameState, attrOf, charById, Character, pickSecret } from './game';

const BASE = import.meta.env.BASE_URL;

interface Props {
  state: GameState;
  setState: (s: GameState) => void;
  onHome: () => void;
  onNewGame: () => void;
}

type Sheet = null | 'secret' | 'ask' | 'guess' | 'code' | 'menu';

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
          <strong>{info.name}</strong>
          <span>{up.length} of {chars.length} left</span>
        </div>
        <button className="code-chip mono" onClick={() => setSheet('code')}>{state.code}</button>
        <button className="icon-btn" onClick={() => setSheet('menu')} aria-label="Menu">⋮</button>
      </header>

      <main className={`grid size-${chars.length}`}>
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
        <button onClick={() => setSheet('ask')}>Ask</button>
        <button onClick={undo} disabled={!state.history.length}>Undo</button>
        <button className="accent" onClick={() => setSheet('guess')}>Guess</button>
      </nav>

      {sheet === 'secret' && (
        <SecretSheet c={secret} state={state} onClose={() => setSheet(null)}
          onReroll={() => { replay(true); setSheet(null); }} />
      )}
      {sheet === 'ask' && (
        <AskSheet state={state} chars={chars} down={down} onClose={() => setSheet(null)}
          onApply={(ids) => { commit([...state.down, ...ids]); setSheet(null); }} />
      )}
      {sheet === 'guess' && (
        <GuessSheet chars={up} onClose={() => setSheet(null)}
          onWrong={(id) => { commit([...state.down, id]); setSheet(null); }}
          onRight={() => { setState({ ...state, won: true }); setSheet(null); }} />
      )}
      {sheet === 'code' && (
        <Modal onClose={() => setSheet(null)}>
          <p className="muted">Your friend enters this code on their phone to get the same board:</p>
          <div className="big-code mono">{state.code}</div>
          <p className="muted small">Both phones should be on the same app version so the boards match.</p>
        </Modal>
      )}
      {sheet === 'menu' && (
        <Modal onClose={() => setSheet(null)}>
          <div className="menu">
            <button className="btn wide" onClick={() => { replay(true); setSheet(null); }}>Play again, same board</button>
            <button className="btn wide" onClick={() => { commit([]); setSheet(null); }}>Flip all cards back up</button>
            <button className="btn wide" onClick={onNewGame}>New game / new board</button>
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
            <button className="btn wide" onClick={onNewGame}>New board</button>
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
  const info = GAMES[state.game];
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
          <p className="muted small">Use this to answer your opponent's questions:</p>
          <dl className="facts">
            {info.questions.map(([k, label]) => (
              <div key={k}><dt>{label}</dt><dd>{attrOf(state.game, c, k) ?? '—'}</dd></div>
            ))}
          </dl>
          {!state.down.length && (
            <button className="btn wide subtle" onClick={onReroll}>Pick a different character</button>
          )}
        </>
      )}
    </Modal>
  );
}

function AskSheet({ state, chars, down, onClose, onApply }: {
  state: GameState; chars: Character[]; down: Set<string>; onClose: () => void; onApply: (ids: string[]) => void;
}) {
  const info = GAMES[state.game];
  const [key, setKey] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const up = chars.filter((c) => !down.has(c.id));

  const values = useMemo(() => {
    if (!key) return [];
    const counts = new Map<string, number>();
    for (const c of up) {
      const v = attrOf(state.game, c, key);
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [key, up, state.game]);

  // Characters with an unknown value are never flipped automatically.
  const flips = (answerYes: boolean) =>
    up.filter((c) => {
      const v = attrOf(state.game, c, key!);
      return v !== undefined && (answerYes ? v !== value : v === value);
    }).map((c) => c.id);

  return (
    <Modal onClose={onClose}>
      <h2>Ask a question</h2>
      <p className="muted small">Ask out loud, then tap the answer and the board flips itself.</p>
      <div className="chips">
        {info.questions.map(([k, label]) => (
          <button key={k} className={key === k ? 'on' : ''} onClick={() => { setKey(k); setValue(null); }}>{label}</button>
        ))}
      </div>
      {key && (
        <div className="chips">
          {values.map(([v, n]) => (
            <button key={v} className={value === v ? 'on' : ''} onClick={() => setValue(v)}>
              {v} <span className="count">{n}</span>
            </button>
          ))}
        </div>
      )}
      {key && value && (
        <>
          <p className="question">
            {key === 'gender' || key === 'rarity'
              ? `“Is your character ${value}?”`
              : `“Is your character’s ${info.questions.find(([k]) => k === key)![1].toLowerCase()} ${value}?”`}
          </p>
          <div className="answer-row">
            <button className="btn yes" onClick={() => onApply(flips(true))}>Yes <small>flips {flips(true).length}</small></button>
            <button className="btn no" onClick={() => onApply(flips(false))}>No <small>flips {flips(false).length}</small></button>
          </div>
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
