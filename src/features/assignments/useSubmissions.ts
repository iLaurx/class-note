import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '../../app/useStorage';
import type { GroupContext, Repositories } from '../../db/repositories';
import { StorageError } from '../../db/errors';
import { ValidationError } from '../../domain/validation';
import type { SubmissionStatus } from '../../domain/models';
import { submissionChanged, type SubmissionDraft } from './assignmentDomain';
import { useDraftGuard } from './useDraftGuard';

type Detail = Awaited<ReturnType<Repositories['loadAssignment']>>;
export function useSubmissions(context: GroupContext, assignmentId: string) {
  const { repositories } = useStorage();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [rows, setRows] = useState<SubmissionDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [readFailed, setReadFailed] = useState(false);
  const locked = useRef(false);
  const sequence = useRef(0);
  const savedRead = useRef(false);
  const dirty = rows.some(submissionChanged);
  useDraftGuard(dirty, busy);
  const load = useCallback(async () => {
    if (!repositories) return;
    const token = ++sequence.current;
    setBusy(true);
    setError('');
    try {
      const next = await repositories.loadAssignment(context, assignmentId);
      if (sequence.current !== token) return;
      setDetail(next);
      setRows(
        next.rows.map(({ enrollment, submission }) => ({
          enrollmentId: enrollment.id,
          status: submission?.status ?? 'pending',
          comment: submission?.comment ?? '',
          expected: submission,
        })),
      );
      setReadFailed(false);
      savedRead.current = false;
    } catch {
      if (sequence.current !== token) return;
      setDetail(null);
      setReadFailed(true);
      setError(
        savedRead.current
          ? 'Las entregas se guardaron, pero no se pudo actualizar la consulta. Reintenta solo la lectura.'
          : 'No se pudo consultar la tarea. Reintenta la lectura.',
      );
    } finally {
      if (sequence.current === token) setBusy(false);
    }
  }, [repositories, context, assignmentId]);
  useEffect(() => {
    let cancelled = false;
    const requests = sequence;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
      requests.current++;
    };
  }, [load]);
  function edit(id: string, fields: { status?: SubmissionStatus; comment?: string }) {
    if (locked.current) return;
    setRows((previous) =>
      previous.map((row) => (row.enrollmentId === id ? { ...row, ...fields } : row)),
    );
    setMessage('');
  }
  async function save() {
    if (!repositories || locked.current || !detail || readFailed) return;
    const changes = rows.filter(submissionChanged);
    if (!changes.length) return;
    const corrections = changes.filter((row) => row.expected).length;
    if (
      corrections &&
      !window.confirm(
        `Se corregirán ${corrections} entregas existentes. ¿Confirmar los cambios del lote?`,
      )
    )
      return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await repositories.saveSubmissions(
        context,
        assignmentId,
        changes.map((row) => ({ ...row, comment: row.comment.trim() || undefined })),
        corrections > 0,
        detail.assignment,
      );
      setRows((previous) =>
        previous.map((row) => {
          const value = saved.find((item) => item.enrollmentId === row.enrollmentId);
          return value
            ? { ...row, status: value.status, comment: value.comment ?? '', expected: value }
            : row;
        }),
      );
      setMessage(`Entregas guardadas: ${changes.length}.`);
      savedRead.current = true;
      await load();
    } catch (cause) {
      setError(
        cause instanceof StorageError || cause instanceof ValidationError
          ? cause.message
          : 'No se pudo guardar. Tu borrador se conserva; reintenta.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return { detail, rows, busy, error, message, readFailed, dirty, edit, save, load };
}
