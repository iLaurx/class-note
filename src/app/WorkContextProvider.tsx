import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStorage } from './useStorage';
import { WorkContext, type Workspace } from './useWorkContext';
import type { Repositories } from '../db/repositories';
import { StorageError } from '../db/errors';
import { ValidationError } from '../domain/validation';
export function WorkContextProvider({ children }: { children: ReactNode }) {
  const { repositories } = useStorage();
  const [data, setData] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const run = useCallback(
    async (operation?: (r: Repositories) => Promise<unknown>) => {
      if (!repositories || locked.current) return false;
      locked.current = true;
      setBusy(true);
      setError('');
      try {
        if (operation) await operation(repositories);
        setData(await repositories.loadWorkspace());
        return true;
      } catch (cause) {
        setError(
          cause instanceof StorageError || cause instanceof ValidationError
            ? cause.message
            : 'No se pudo cargar el contexto. Reintenta la operación.',
        );
        // A failed refresh must never leave an obsolete context visible.
        setData(null);
        return false;
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [repositories],
  );
  useEffect(() => {
    let cancelled = false;
    if (repositories) {
      void repositories.loadWorkspace().then(
        (workspace) => {
          if (!cancelled) {
            setData(workspace);
            setBusy(false);
          }
        },
        () => {
          if (!cancelled) {
            setError('No se pudo cargar el contexto. Reintenta la operación.');
            setBusy(false);
          }
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [repositories]);
  return <WorkContext.Provider value={{ data, busy, error, run }}>{children}</WorkContext.Provider>;
}
