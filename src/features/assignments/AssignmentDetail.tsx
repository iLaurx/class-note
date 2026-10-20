import { useEffect, useRef, useState } from 'react';
import type { GroupContext } from '../../db/repositories';
import type { SubmissionStatus } from '../../domain/models';
import { allowNavigation } from '../../app/pendingChanges';
import {
  searchText,
  submissionChanged,
  submissionCounts,
  submissionLabels,
} from './assignmentDomain';
import { useSubmissions } from './useSubmissions';

export function AssignmentDetail({
  context,
  assignmentId,
}: {
  context: GroupContext;
  assignmentId: string;
}) {
  const day = useSubmissions(context, assignmentId);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (day.detail) heading.current?.focus();
  }, [day.detail]);
  const counts = submissionCounts(day.rows);
  const changes = day.rows.filter(submissionChanged).length;
  return (
    <section aria-label="Entregas de la tarea" aria-busy={day.busy}>
      {day.busy && <p role="status">Cargando o guardando entregas…</p>}
      {day.error && <p role="alert">{day.error}</p>}
      {day.message && <p role="status">{day.message}</p>}
      {day.readFailed && (
        <button disabled={day.busy} onClick={() => void day.load()}>
          Reintentar lectura
        </button>
      )}
      {day.error && !day.readFailed && (
        <button
          disabled={day.busy}
          onClick={() => {
            if (allowNavigation()) void day.load();
          }}
        >
          Revisar entregas guardadas
        </button>
      )}
      {day.detail && (
        <>
          <h3 tabIndex={-1} ref={heading}>
            {day.detail.assignment.title}
          </h3>
          <p>
            Asignación: {day.detail.assignment.assignedDate} · Entrega:{' '}
            {day.detail.assignment.dueDate ?? 'Sin fecha'}
          </p>
          {day.detail.assignment.description && (
            <p className="assignment-description">{day.detail.assignment.description}</p>
          )}
          <p>
            Recuentos de toda la tarea{day.dirty ? ' · Vista previa' : ''}. {changes} cambios
            pendientes en total, incluidas filas ocultas por filtros.
          </p>
          <dl className="attendance-counts" aria-label="Recuentos de toda la tarea">
            {Object.entries(submissionLabels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{counts[key as SubmissionStatus]}</dd>
              </div>
            ))}
            <div>
              <dt>Sin captura</dt>
              <dd>{counts.uncaptured}</dd>
            </div>
            <div>
              <dt>Total de matrículas</dt>
              <dd>{counts.total}</dd>
            </div>
          </dl>
          <div className="assignment-filters">
            <label>
              Buscar alumno
              <input value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              Filtrar entregas por estado
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos</option>
                {Object.entries(submissionLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button disabled={day.busy || !changes} onClick={() => void day.save()}>
            Guardar entregas ({changes} cambios en toda la tarea)
          </button>
          {!day.rows.length && <p>No hay matrículas para la fecha de asignación.</p>}
          {day.rows.length > 0 &&
            !day.detail.rows.some(
              (member, index) =>
                (!status || day.rows[index]?.status === status) &&
                searchText(`${member.student.lastName}, ${member.student.firstName}`).includes(
                  searchText(query),
                ),
            ) && <p>Sin coincidencias de alumnos.</p>}
          <ul className="attendance-list">
            {day.detail.rows.map(({ enrollment, student }, index) => {
              const row = day.rows[index];
              const name = `${student.lastName}, ${student.firstName}`;
              if (
                !row ||
                (status && row.status !== status) ||
                !searchText(name).includes(searchText(query))
              )
                return null;
              return (
                <li className="panel attendance-row" key={enrollment.id}>
                  <div>
                    <strong>{name}</strong>
                    {!student.active && <p>Ficha archivada</p>}
                    {enrollment.status === 'inactive' && (
                      <p>
                        Matrícula inactiva{!enrollment.leftAt ? ' · Sin salida registrada' : ''}
                      </p>
                    )}
                    {!row.expected && <p>Aún no tiene registro guardado</p>}
                    {submissionChanged(row) && <p>Cambios pendientes</p>}
                  </div>
                  <label>
                    Estado de {name}
                    <select
                      aria-label={`Estado de ${name}`}
                      disabled={day.busy}
                      value={row.status}
                      onChange={(event) =>
                        day.edit(enrollment.id, { status: event.target.value as SubmissionStatus })
                      }
                    >
                      {Object.entries(submissionLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Comentario de {name} (opcional)
                    <input
                      disabled={day.busy}
                      value={row.comment}
                      onChange={(event) => day.edit(enrollment.id, { comment: event.target.value })}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          {day.detail.incidents.length > 0 && (
            <section aria-label="Incidencias de entregas">
              <h3>Entregas fuera de la población</h3>
              <p>
                Edición bloqueada hasta corregir el historial o la relación. Estas entregas se
                conservan y no forman parte de los recuentos de población.
              </p>
              <ul>
                {day.detail.incidents.map(({ submission, student, reason }) => (
                  <li key={submission.id}>
                    {student ? `${student.lastName}, ${student.firstName}` : 'Ficha no disponible'}{' '}
                    · Matrícula {submission.enrollmentId} · Entrega {submission.id} ·{' '}
                    {submissionLabels[submission.status]} · {submission.comment ?? 'Sin comentario'}
                    {' · '}
                    {reason}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}
