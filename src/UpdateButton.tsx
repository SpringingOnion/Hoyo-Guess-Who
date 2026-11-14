import { useState } from 'react';

type Status = 'idle' | 'checking' | 'updating' | 'latest' | 'offline';

const LABEL: Record<Status, string> = {
  idle: 'Check for updates',
  checking: 'Checking…',
  updating: 'Updating…',
  latest: 'You have the latest characters ✓',
  offline: "Couldn't check. Are you online?",
};

/**
 * Asks the service worker to look for a new deploy. If there is one, vite-plugin-pwa's
 * autoUpdate mode installs it and reloads the page with the new characters.
 */
export default function UpdateButton() {
  const [status, setStatus] = useState<Status>('idle');

  const check = async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) { location.reload(); return; }
    setStatus('checking');
    try {
      await reg.update();
      const incoming = reg.installing ?? reg.waiting;
      if (incoming) {
        setStatus('updating');
        // autoUpdate reloads on controllerchange; this is just a fallback.
        setTimeout(() => location.reload(), 8000);
      } else {
        setStatus('latest');
      }
    } catch {
      setStatus('offline');
    }
  };

  return (
    <button className="update-btn" onClick={check} disabled={status === 'checking' || status === 'updating'}>
      {LABEL[status]}
    </button>
  );
}
