import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '../../app/useStorage';
import type { GroupContext, Repositories } from '../../db/repositories';
import { StorageError } from '../../db/errors';
import { ValidationError } from '../../domain/validation';

type Rows = Awaited<ReturnType<Repositories['listGroupStudents']>>;
type Records = Awaited<ReturnType<Repositories['listStudentRecords']>>;
export function useStudents(context: GroupContext) {
  const { repositories } = useStorage();
  const [rows, setRows] = useState<Rows | null>(null);
  const [records, setRecords] = useState<Records | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const alive = useRef(true);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    if (!repositories) return;
    const token = ++sequence.current;
    try {
      const result = await repositories.listGroupStudents(context);
      if (alive.current && token === sequence.current) {
        setRows(result);
        setError('');
      }
    } catch {
      if (alive.current && token === sequence.current) {
        setRows(null);
        setError('No se pudo cargar la lista. Reintenta.');
      }
    }
  }, [repositories, context]);
  useEffect(() => {
    alive.current = true;
    void Promise.resolve().then(load);
    return () => {
      alive.current = false;
    };
  }, [load]);
  async function run(operation: (r: Repositories) => Promise<unknown>, global = false) {
    if (!repositories || locked.current || !alive.current) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    let saved = false;
    try {
      await operation(repositories);
      saved = !global;
      if (!alive.current) return false;
      if (global || records) {
        const next = await repositories.listStudentRecords();
        if (alive.current) setRecords(next);
      }
      await load();
      return alive.current;
    } catch (cause) {
      if (saved && alive.current) {
        setRecords(null);
        setRows(null);
        setError(
          'Los cambios se guardaron, pero no se pudo actualizar la consulta. Reintenta la lista antes de continuar.',
        );
        return true;
      }
      if (alive.current)
        setError(
          cause instanceof StorageError || cause instanceof ValidationError
            ? cause.message
            : 'No se pudo completar la operación. Reintenta.',
        );
      return false;
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return { rows, records, busy, error, load, run, openRecords: () => run(async () => {}, true) };
}
