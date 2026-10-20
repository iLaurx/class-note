import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkContext } from '../../app/useWorkContext';
import { useStorage } from '../../app/useStorage';
import { allowNavigation } from '../../app/pendingChanges';
import type { GroupContext } from '../../db/repositories';
import type { Assignment, SchoolYear } from '../../domain/models';
import { filterAssignments } from './assignmentDomain';
import { AssignmentForm } from './AssignmentForm';
import { AssignmentDetail } from './AssignmentDetail';

export function Assignments() {
  const { data } = useWorkContext();
  const year = data?.years.find((item) => item.id === data.selection.schoolYearId);
  const groupId = data?.selection.groupId;
  return (
    <section className="attendance assignments" aria-label="Tareas del grupo">
      <h2>Tareas del grupo</h2>
      <a href="#/inicio">Volver a Inicio</a>
      {!year || !groupId ? (
        <p>Selecciona un ciclo y un grupo para gestionar tareas.</p>
      ) : (
        <AssignmentWorkspace key={`${year.id}:${groupId}`} year={year} groupId={groupId} />
      )}
    </section>
  );
}
function AssignmentWorkspace({ year, groupId }: { year: SchoolYear; groupId: string }) {
  const { repositories } = useStorage();
  const context: GroupContext = useMemo(
    () => ({ schoolYearId: year.id, groupId }),
    [year.id, groupId],
  );
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<
    | { type: 'list' }
    | { type: 'form'; assignment: Assignment | null }
    | { type: 'detail'; id: string }
  >({ type: 'list' });
  const sequence = useRef(0);
  const [viewVersion, setViewVersion] = useState(0);
  const load = useCallback(async () => {
    if (!repositories) return;
    const token = ++sequence.current;
    setBusy(true);
    setError('');
    try {
      const next = await repositories.listAssignments(context);
      if (sequence.current === token) setRows(next);
    } catch {
      if (sequence.current === token) {
        setRows(null);
        setError('No se pudo consultar el listado. Reintenta solo la lectura.');
      }
    } finally {
      if (sequence.current === token) setBusy(false);
    }
  }, [repositories, context]);
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
  function navigate(next: typeof view) {
    if (allowNavigation()) {
      setViewVersion((value) => value + 1);
      setView(next);
      setSaved(false);
    }
  }
  const filtered = filterAssignments(rows ?? [], query, from, to);
  return (
    <div aria-busy={busy}>
      {saved && <p role="status">La tarea se guardó.</p>}
      {busy && <p role="status">Cargando tareas…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button disabled={busy} onClick={() => void load()}>
            Reintentar listado
          </button>
        </>
      )}
      <div className="attendance-actions">
        <button disabled={busy} onClick={() => navigate({ type: 'form', assignment: null })}>
          Crear tarea
        </button>
        {view.type !== 'list' && (
          <button onClick={() => navigate({ type: 'list' })}>Volver al listado</button>
        )}
      </div>
      {view.type === 'form' ? (
        <AssignmentForm
          key={viewVersion}
          context={context}
          year={year}
          assignment={view.assignment}
          onCancel={() => setView({ type: 'list' })}
          onSaved={() => {
            setSaved(true);
            setView({ type: 'list' });
            void load();
          }}
        />
      ) : (
        <>
          <div className="assignment-filters">
            <label>
              Buscar tareas por título
              <input value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              Asignación desde
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label>
              Asignación hasta
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>
          {rows && !rows.length && <p>Este grupo aún no tiene tareas.</p>}
          {rows && rows.length > 0 && !filtered.length && <p>Sin coincidencias de tareas.</p>}
          <ul className="school-list">
            {filtered.map((assignment) => (
              <li key={assignment.id}>
                <strong>{assignment.title}</strong>
                <span>
                  Asignación: {assignment.assignedDate} · Entrega:{' '}
                  {assignment.dueDate ?? 'Sin fecha'}
                </span>
                <button onClick={() => navigate({ type: 'detail', id: assignment.id })}>
                  Ver entregas de {assignment.title}
                </button>
                <button onClick={() => navigate({ type: 'form', assignment })}>
                  Editar tarea {assignment.title}
                </button>
              </li>
            ))}
          </ul>
          {view.type === 'detail' && (
            <AssignmentDetail key={viewVersion} context={context} assignmentId={view.id} />
          )}
        </>
      )}
    </div>
  );
}
