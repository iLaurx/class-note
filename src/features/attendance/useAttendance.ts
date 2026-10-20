import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '../../app/useStorage';
import { registerPendingChanges } from '../../app/pendingChanges';
import type { GroupContext, Repositories } from '../../db/repositories';
import type { AttendanceStatus } from '../../domain/models';
import { StorageError } from '../../db/errors';
import { ValidationError } from '../../domain/validation';
import { isChanged, type AttendanceDraft } from './attendanceDomain';

type Members = Awaited<ReturnType<Repositories['loadAttendanceDay']>>;
export function useAttendance(context: GroupContext, date: string) {
  const { repositories } = useStorage();
  const [members, setMembers] = useState<Members | null>(null);
  const [rows, setRows] = useState<AttendanceDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [readFailed, setReadFailed] = useState(false);
  const locked = useRef(false);
  const sequence = useRef(0);
  const pendingNotes = useRef<AttendanceDraft[]>([]);
  const dirty = rows.some(isChanged);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const load = useCallback(
    async (saved = false, pending: AttendanceDraft[] = pendingNotes.current) => {
      if (!repositories || !date) return;
      const token = ++sequence.current;
      setBusy(true);
      setError('');
      try {
        const next = await repositories.loadAttendanceDay(context, date);
        if (sequence.current !== token) return;
        setMembers(next);
        setRows(
          next.map(({ enrollment, attendance }) => ({
            enrollmentId: enrollment.id,
            status: attendance?.status ?? '',
            note:
              attendance?.note ??
              pending.find((row) => row.enrollmentId === enrollment.id)?.note ??
              '',
            expected: attendance,
          })),
        );
        setReadFailed(false);
      } catch {
        if (sequence.current !== token) return;
        setMembers(null);
        setReadFailed(true);
        setError(
          saved
            ? 'La asistencia se guardó, pero no se pudo actualizar la consulta. Reintenta solo la lectura.'
            : 'No se pudo consultar el día. Reintenta la lectura.',
        );
      } finally {
        if (sequence.current === token) setBusy(false);
      }
    },
    [repositories, context, date],
  );
  useEffect(() => {
    const requests = sequence;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
      requests.current++;
    };
  }, [load]);
  useEffect(
    () =>
      registerPendingChanges(() => {
        if (locked.current) return false;
        return (
          !dirtyRef.current ||
          window.confirm(
            'Hay cambios de asistencia sin guardar. Aceptar descarta el borrador; Cancelar permite continuar editando.',
          )
        );
      }),
    [],
  );
  useEffect(() => {
    const closing = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || locked.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', closing);
    return () => window.removeEventListener('beforeunload', closing);
  }, []);

  function edit(id: string, fields: { status?: AttendanceStatus | ''; note?: string }) {
    setRows((previous) =>
      previous.map((row) => (row.enrollmentId === id ? { ...row, ...fields } : row)),
    );
    setMessage('');
  }
  function markAll() {
    if (
      rows.some((row) => row.status && row.status !== 'present') &&
      !window.confirm(
        'Se reemplazarán los estados seleccionados de todo el listado por Presente. Las notas se conservan. ¿Continuar?',
      )
    )
      return;
    setRows((previous) => previous.map((row) => ({ ...row, status: 'present' })));
    setMessage('');
  }
  function review() {
    pendingNotes.current = [];
    dirtyRef.current = false;
    setRows([]);
    void load(false, []);
  }
  async function save() {
    if (!repositories || locked.current || readFailed) return;
    const changes = rows.filter((row) => row.status && isChanged(row));
    if (!changes.length) {
      setMessage('Selecciona un estado para guardar.');
      return;
    }
    const corrections = changes.filter((row) => row.expected).length;
    if (
      corrections &&
      !window.confirm(
        `Se corregirán ${corrections} registros de asistencia existentes. ¿Confirmar los cambios del lote?`,
      )
    )
      return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const savedRows = await repositories.saveAttendanceDay(
        context,
        date,
        changes.map((row) => ({
          ...row,
          note: row.note.trim() || undefined,
        })),
        corrections > 0,
      );
      const pending = rows.filter((row) => !row.status && isChanged(row));
      pendingNotes.current = pending;
      dirtyRef.current = pending.length > 0;
      setRows(
        rows.map((row) => {
          const saved = savedRows.find((item) => item.enrollmentId === row.enrollmentId);
          return saved
            ? { ...row, status: saved.status, note: saved.note ?? '', expected: saved }
            : row;
        }),
      );
      setMessage(`Asistencia guardada. ${rows.filter((row) => !row.status).length} sin registrar.`);
      await load(true, pending);
    } catch (cause) {
      setError(
        cause instanceof StorageError || cause instanceof ValidationError
          ? cause.message
          : 'No se pudo guardar la asistencia. Tu borrador se conserva; reintenta.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    members,
    rows,
    busy,
    error,
    message,
    dirty,
    readFailed,
    edit,
    markAll,
    save,
    load,
    review,
  };
}
