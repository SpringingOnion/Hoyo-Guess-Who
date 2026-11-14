import { useEffect, useState } from 'react';
import Home from './Home';
import Board from './Board';
import { GameState, loadGame, newGame, saveGame } from './game';

export default function App() {
  const [saved, setSaved] = useState<GameState | null>(() => loadGame());
  const [playing, setPlaying] = useState(false);

  const update = (s: GameState) => {
    setSaved(s);
    saveGame(s);
  };

  // Android back button: leave the board instead of closing the app.
  useEffect(() => {
    if (!playing) return;
    history.pushState({ board: true }, '');
    const onPop = () => setPlaying(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [playing]);

  const leave = () => {
    if (history.state?.board) history.back();
    else setPlaying(false);
  };

  if (playing && saved) {
    return <Board state={saved} setState={update} onHome={leave} onNewGame={leave} />;
  }
  return (
    <Home
      saved={saved}
      onResume={() => setPlaying(true)}
      onStart={(game, filters) => {
        const g = newGame(game, filters);
        if (g) { update(g); setPlaying(true); }
      }}
    />
  );
}
