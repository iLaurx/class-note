import { useEffect, useRef } from 'react';
import { registerPendingChanges } from '../../app/pendingChanges';

export function useDraftGuard(dirty: boolean, busy: boolean) {
  const state = useRef({ dirty, busy });
  useEffect(() => {
    state.current = { dirty, busy };
  }, [dirty, busy]);
  useEffect(() => {
    const unregister = registerPendingChanges(
      () =>
        !state.current.busy &&
        (!state.current.dirty ||
          window.confirm(
            'Hay cambios de tareas sin guardar. Aceptar descarta el borrador; Cancelar permite continuar editando.',
          )),
    );
    const closing = (event: BeforeUnloadEvent) => {
      if (state.current.dirty || state.current.busy) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', closing);
    return () => {
      unregister();
      window.removeEventListener('beforeunload', closing);
    };
  }, []);
}
