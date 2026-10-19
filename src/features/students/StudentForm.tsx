import { useState, type SubmitEvent } from 'react';
import type { Group, SchoolYear } from '../../domain/models';
import type { useStudents } from './useStudents';
import type { StudentFormState } from './studentFormState';
import { fullName, matches, localToday } from './studentPresentation';
export function StudentForm({
  form,
  year,
  group,
  state,
  done,
}: {
  form: StudentFormState;
  year: SchoolYear;
  group: Group;
  state: ReturnType<typeof useStudents>;
  done: () => void;
}) {
  const enrollment = 'enrollment' in form ? form.enrollment : undefined;
  const student = 'student' in form ? form.student : undefined;
  const [firstName, setFirst] = useState(student?.firstName ?? '');
  const [lastName, setLast] = useState(student?.lastName ?? '');
  const [joinedAt, setJoined] = useState(enrollment?.joinedAt ?? localToday(year));
  const [leftAt, setLeft] = useState(enrollment?.leftAt ?? '');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const existing = state.records?.enrollments.find(
    (e) => e.studentId === selected && e.groupId === group.id,
  );
  const titles = {
    new: 'Nuevo alumno',
    existing: 'Matricular ficha existente',
    edit: 'Editar ficha',
    dates: 'Corregir fechas',
    leave: 'Confirmar baja del grupo',
    reactivate: 'Confirmar reactivación de matrícula',
    archive: 'Confirmar archivo global',
  };
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const context = { schoolYearId: year.id, groupId: group.id };
    if (
      await state.run(async (r) => {
        switch (form.kind) {
          case 'new':
            return r.createStudentWithEnrollment(context, { firstName, lastName, joinedAt });
          case 'edit':
            return r.updateStudent(form.student.id, { firstName, lastName });
          case 'archive':
            return r.setStudentActive(form.student.id, false);
          case 'existing':
            if (existing)
              return r.updateEnrollment(
                { ...context, enrollmentId: existing.id },
                { joinedAt, leftAt: leftAt || undefined, status: 'active' },
              );
            return r.createEnrollment(context, { studentId: selected, joinedAt, status: 'active' });
          default:
            return r.updateEnrollment(
              { ...context, enrollmentId: form.enrollment.id },
              {
                joinedAt,
                leftAt: leftAt || undefined,
                status:
                  form.kind === 'leave'
                    ? 'inactive'
                    : form.kind === 'reactivate'
                      ? 'active'
                      : form.enrollment.status,
              },
            );
        }
      })
    )
      done();
  }
  return (
    <form className="school-form" aria-label={titles[form.kind]} onSubmit={save}>
      <h3>{titles[form.kind]}</h3>
      <p>
        Destino: {year.label} · {group.grade}.º {group.name}
      </p>
      {(form.kind === 'new' || form.kind === 'existing') && (
        <>
          <label>
            Buscar fichas en todos los grupos
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <p>Busca antes de crear. Los nombres iguales están permitidos; no se fusionan fichas.</p>
          <ul className="school-list">
            {state.records?.students
              .filter((s) => matches(s, search))
              .map((s) => (
                <li key={s.id}>
                  <strong>
                    {fullName(s)} · {s.active ? 'Activo' : 'Archivado'}
                  </strong>
                  <span>
                    Ficha: {s.id} · Creada: {s.createdAt.slice(0, 10)}
                  </span>
                  {state.records?.enrollments
                    .filter((e) => e.studentId === s.id)
                    .map((e) => {
                      const g = state.records?.groups.find((g) => g.id === e.groupId);
                      const y = state.records?.years.find((y) => y.id === g?.schoolYearId);
                      return (
                        <span key={e.id}>
                          {y?.label} · {g?.grade}.º {g?.name} ·{' '}
                          {e.status === 'active' ? 'Activa' : 'Inactiva'}
                        </span>
                      );
                    })}
                  {!s.active && (
                    <button
                      type="button"
                      disabled={state.busy}
                      onClick={() => void state.run((r) => r.setStudentActive(s.id, true))}
                    >
                      Reactivar ficha de {fullName(s)}
                    </button>
                  )}
                  {form.kind === 'existing' && (
                    <label>
                      <input
                        type="radio"
                        name="student"
                        required
                        disabled={!s.active || state.busy}
                        checked={selected === s.id}
                        onChange={() => {
                          setSelected(s.id);
                          const e = state.records?.enrollments.find(
                            (e) => e.studentId === s.id && e.groupId === group.id,
                          );
                          setJoined(e?.joinedAt ?? localToday(year));
                          setLeft(e?.leftAt ?? '');
                        }}
                      />{' '}
                      Seleccionar {fullName(s)} · {s.id}
                    </label>
                  )}
                </li>
              ))}
          </ul>
          {state.records?.students.filter((s) => matches(s, search)).length === 0 && (
            <p>No hay coincidencias entre las fichas globales.</p>
          )}
        </>
      )}
      {(form.kind === 'new' || form.kind === 'edit') && (
        <>
          <label>
            Nombre o nombres
            <input
              autoFocus={form.kind === 'edit'}
              required
              value={firstName}
              onChange={(e) => setFirst(e.target.value)}
            />
          </label>
          <label>
            Apellido o apellidos
            <input required value={lastName} onChange={(e) => setLast(e.target.value)} />
          </label>
        </>
      )}
      {form.kind !== 'edit' && form.kind !== 'archive' && (
        <>
          <label>
            Fecha de ingreso
            <input
              autoFocus={!!enrollment}
              required
              type="date"
              min={year.startDate}
              max={year.endDate}
              value={joinedAt}
              onChange={(e) => setJoined(e.target.value)}
            />
          </label>
          {(enrollment || existing) && (
            <>
              <label>
                Fecha de salida (opcional)
                <input
                  type="date"
                  min={joinedAt}
                  max={year.endDate}
                  value={leftAt}
                  onChange={(e) => setLeft(e.target.value)}
                />
              </label>
              <p>
                Confirma el intervalo. Para retirar la salida, vacía su campo explícitamente. Se
                conservan las asistencias.
              </p>
            </>
          )}
        </>
      )}
      {existing && (
        <p>
          {existing.status === 'active'
            ? 'Ya tiene matrícula activa en este grupo.'
            : 'Se reactivará la matrícula existente, conservando su identidad e historial.'}
        </p>
      )}
      {form.kind === 'leave' && (
        <p>
          Solo se dará de baja esta matrícula. La ficha y las demás matrículas se conservan. No se
          inventará una fecha de salida.
        </p>
      )}
      {form.kind === 'archive' && (
        <p>
          Archivar a {fullName(form.student)} desactivará{' '}
          {
            state.records?.enrollments.filter(
              (e) => e.studentId === form.student.id && e.status === 'active',
            ).length
          }{' '}
          matrículas activas. Se conserva todo el historial y sus fechas. Reactivar la ficha no
          reactiva matrículas.
        </p>
      )}
      <div>
        <button
          autoFocus={form.kind === 'archive'}
          disabled={
            state.busy || (form.kind === 'existing' && (!selected || existing?.status === 'active'))
          }
          type="submit"
        >
          {form.kind === 'archive'
            ? 'Confirmar archivo del alumno'
            : form.kind === 'leave'
              ? 'Confirmar baja'
              : existing
                ? 'Confirmar reactivación'
                : 'Guardar alumno'}
        </button>
        <button disabled={state.busy} type="button" onClick={done}>
          Cancelar formulario
        </button>
      </div>
    </form>
  );
}
