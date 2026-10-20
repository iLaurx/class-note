import { useSyncExternalStore } from 'react';
import { resolveSection } from './navigation';
import { allowNavigation } from './pendingChanges';

function subscribe(onChange: () => void) {
  let previous = window.location.hash;
  const change = () => {
    if (window.location.hash !== previous && !allowNavigation()) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}${previous}`,
      );
    }
    previous = window.location.hash;
    onChange();
  };
  window.addEventListener('hashchange', change);
  return () => window.removeEventListener('hashchange', change);
}

export function useNavigation() {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  return resolveSection(hash || '#/inicio');
}
