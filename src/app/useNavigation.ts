import { useSyncExternalStore } from 'react';
import { resolveSection } from './navigation';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useNavigation() {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  return resolveSection(hash || '#/inicio');
}
