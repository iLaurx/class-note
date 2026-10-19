import { StudentForm } from './StudentForm';
import type { StudentFormState } from './studentFormState';
import { fullName, matches } from './studentPresentation';
import { useMemo, useRef, useState } from 'react';
import { useWorkContext } from '../../app/useWorkContext';
import type { Group, SchoolYear } from '../../domain/models';
import { useStudents } from './useStudents';

export function Students() {
  const { data, busy } = useWorkContext();
  const year = data?.years.find((y) => y.id === data.selection.schoolYearId);
  const group = data?.groups.find((g) => g.id === data.selection.groupId);
  return (
    <>
      <p role="status">
        Al cambiar de contexto se cierran los formularios y detalles pendientes. Vuelve a abrirlos
        en el grupo de destino.
      </p>
      {year && group && !busy ? (
        <StudentGroup key={`${year.id}/${group.id}`} year={year} group={group} />
      ) : (
        <section className="panel school-management">
          <h2>Alumnos del grupo</h2>
          <p>
            {busy
              ? 'Cargando contexto…'
              : 'Selecciona un ciclo y un grupo en Contexto de trabajo. Puedes crearlos en Configuración.'}
          </p>
          <a href="#/inicio">Volver a Inicio</a>
        </section>
      )}
    </>
  );
}
function StudentGroup({ year, group }: { year: SchoolYear; group: Group }) {
  const context = useMemo(
    () => ({ schoolYearId: year.id, groupId: group.id }),
    [year.id, group.id],
  );
  const state = useStudents(context);
  const [query, setQuery] = useState('');
  const [inactive, setInactive] = useState(false);
  const [form, setForm] = useState<StudentFormState | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const done = () => {
    setForm(null);
    heading.current?.focus();
  };
  const rows = state.rows
    ?.filter(
      (row) => (inactive || row.enrollment.status === 'active') && matches(row.student, query),
    )
    .sort((a, b) => fullName(a.student).localeCompare(fullName(b.student), 'es'));
  const student = state.records?.students.find((s) => s.id === detail);
  const history = state.records?.enrollments.filter((e) => e.studentId === detail) ?? [];
  async function open(next: StudentFormState) {
    if (
      (next.kind === 'new' || next.kind === 'existing' || next.kind === 'archive') &&
      !(await state.openRecords())
    )
      return;
    setForm(next);
  }
  return (
    <section className="panel school-management" aria-busy={state.busy}>
      <h2 tabIndex={-1} ref={heading}>
        Alumnos del grupo
      </h2>
      <p>
        {year.label} · {group.grade}.º {group.name} · {group.shift || 'Sin turno'}
      </p>
      <p>La ficha pertenece al alumno; la matrícula pertenece a este grupo.</p>
      <a href="#/inicio">Volver a Inicio</a>
      {state.error && (
        <p role="alert">
          {state.error} <button onClick={() => void state.load()}>Reintentar lista</button>
        </p>
      )}
      {!state.rows && !state.error && <p role="status">Cargando alumnos…</p>}
      <div>
        <button disabled={state.busy || !!form} onClick={() => void open({ kind: 'new' })}>
          Agregar alumno
        </button>
        <button disabled={state.busy || !!form} onClick={() => void open({ kind: 'existing' })}>
          Matricular alumno existente
        </button>
      </div>
      <label className="school-form">
        Buscar en este grupo
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label className="archive-filter">
        <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />{' '}
        Mostrar matrículas inactivas
      </label>
      {state.rows && rows?.length === 0 && (
        <p>
          {query.trim()
            ? 'No hay coincidencias en este grupo.'
            : 'No hay alumnos con el filtro actual. Agrega un alumno, matricula una ficha existente o muestra las matrículas inactivas.'}
        </p>
      )}
      <ul className="school-list">
        {rows?.map(({ student: s, enrollment: e }) => (
          <li key={e.id}>
            <strong>{fullName(s)}</strong>
            <span>
              {e.status === 'active' ? 'Matrícula activa' : 'Matrícula inactiva'} ·{' '}
              {s.active ? 'Ficha activa' : 'Alumno archivado'}
            </span>
            <button
              disabled={state.busy || !!form}
              onClick={async () => {
                if (await state.openRecords()) setDetail(s.id);
              }}
            >
              Ver ficha de {fullName(s)}
            </button>
          </li>
        ))}
      </ul>
      {student && (
        <section className="school-form" aria-label="Detalle del alumno">
          <h3>
            {fullName(student)} · {student.active ? 'Ficha activa' : 'Archivado'}
          </h3>
          <button
            disabled={state.busy || !!form}
            onClick={() => setForm({ kind: 'edit', student })}
          >
            Editar ficha
          </button>
          {student.active ? (
            <button
              disabled={state.busy || !!form}
              onClick={() => void open({ kind: 'archive', student })}
            >
              Archivar alumno
            </button>
          ) : (
            <button
              disabled={state.busy || !!form}
              onClick={() => void state.run((r) => r.setStudentActive(student.id, true))}
            >
              Reactivar ficha
            </button>
          )}
          <h3>Historial de matrículas</h3>
          <ul className="school-list">
            {history.map((e) => {
              const g = state.records?.groups.find((g) => g.id === e.groupId);
              const y = state.records?.years.find((y) => y.id === g?.schoolYearId);
              return (
                <li key={e.id}>
                  <strong>
                    {y?.label} · {g?.grade}.º {g?.name}{' '}
                    {e.groupId === group.id ? '· Grupo actual' : ''}
                  </strong>
                  <span>
                    {g?.shift || 'Sin turno'} · {e.status === 'active' ? 'Activa' : 'Inactiva'} ·
                    Ingreso: {e.joinedAt} · Salida: {e.leftAt || 'Sin fecha'}
                  </span>
                  {(g?.archived || y?.archived) && <span>Grupo o ciclo archivado</span>}
                  {e.groupId === group.id && (
                    <div>
                      <button
                        disabled={state.busy || !!form}
                        onClick={() => setForm({ kind: 'dates', enrollment: e })}
                      >
                        Corregir fechas
                      </button>
                      <button
                        disabled={
                          state.busy || !!form || (!student.active && e.status === 'inactive')
                        }
                        onClick={() =>
                          setForm({
                            kind: e.status === 'active' ? 'leave' : 'reactivate',
                            enrollment: e,
                          })
                        }
                      >
                        {e.status === 'active' ? 'Dar de baja del grupo' : 'Reactivar matrícula'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            disabled={!!form || state.busy}
            onClick={() => {
              setDetail(null);
              heading.current?.focus();
            }}
          >
            Cerrar detalle
          </button>
        </section>
      )}
      {form && (
        <StudentForm
          key={JSON.stringify(form)}
          form={form}
          year={year}
          group={group}
          state={state}
          done={done}
        />
      )}
    </section>
  );
}
