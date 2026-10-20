import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkContext } from '../../app/useWorkContext';
import { useStorage } from '../../app/useStorage';
import type { SchoolYear, StudentNote } from '../../domain/models';
import type { Repositories } from '../../db/repositories';
import { fullName } from '../students/studentPresentation';
import { useDraftGuard } from '../assignments/useDraftGuard';
import { ValidationError } from '../../domain/validation';
import { StorageError } from '../../db/errors';
import { noteCategories, noteHistory, noteMemberCondition } from './notesDomain';
import { NoteForm } from './NoteForm';

export function Observations() {
  const { data } = useWorkContext();
  const year = data?.years.find((item) => item.id === data.selection.schoolYearId);
  const groupId = data?.selection.groupId;
  return (
    <section className="attendance assignments" aria-label="Observaciones del grupo">
      <h2>Observaciones del grupo</h2>
      <a href="#/inicio">Volver a Inicio</a>
      {!year || !groupId ? (
        <p>Selecciona un ciclo y un grupo para registrar observaciones.</p>
      ) : (
        <NotesWorkspace key={`${year.id}:${groupId}`} year={year} groupId={groupId} />
      )}
    </section>
  );
}
function NotesWorkspace({ year, groupId }: { year: SchoolYear; groupId: string }) {
  const { repositories } = useStorage();
  const context = useMemo(() => ({ schoolYearId: year.id, groupId }), [year.id, groupId]);
  const [data, setData] = useState<Awaited<ReturnType<Repositories['loadNotesGroup']>> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [form, setForm] = useState<{ note: StudentNote | null } | null>(null);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const deleting = useRef(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    if (!repositories) return;
    const token = ++sequence.current;
    setBusy(true);
    setError('');
    try {
      const next = await repositories.loadNotesGroup(context);
      if (sequence.current === token) setData(next);
    } catch {
      if (sequence.current === token) {
        setData(null);
        setError('No se pudieron consultar las observaciones. Reintenta solo la lectura.');
      }
    } finally {
      if (sequence.current === token) setBusy(false);
    }
  }, [repositories, context]);
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
  let history: StudentNote[] = [];
  let filterError = '';

  try {
    history = noteHistory(
      data?.notes ?? [],
      data?.members ?? [],
      enrollmentId,
      category,
      from,
      to,
      search,
    );
  } catch {
    filterError = 'Elige fechas reales y un rango de historial ordenado.';
  }
  return (
    <div aria-busy={busy}>
      {!form && <NotesOperationGuard busy={removing} />}
      {saved && <p role="status">La observación se guardó.</p>}
      {deleted && <p role="status">La observación se eliminó.</p>}
      {busy && <p role="status">Cargando observaciones…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button disabled={busy} onClick={() => void load()}>
            Reintentar consulta
          </button>
        </>
      )}
      {!form && data && !busy && (
        <>
          {!data.members.length ? (
            <p>Este grupo aún no tiene matrículas. Agrega alumnos para registrar observaciones.</p>
          ) : (
            <button
              onClick={() => {
                setSaved(false);
                setDeleted(false);
                setForm({ note: null });
              }}
            >
              Registrar observación
            </button>
          )}
          <section aria-label="Historial de observaciones">
            <h3>Historial de observaciones</h3>
            <div className="assignment-filters">
              <label>
                Buscar por nombre o texto
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label>
                Filtrar por categoría
                <select
                  aria-label="Filtrar por categoría"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {Object.entries(noteCategories).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Filtrar por matrícula
                <select
                  aria-label="Filtrar por matrícula"
                  value={enrollmentId}
                  onChange={(event) => setEnrollmentId(event.target.value)}
                >
                  <option value="">Todas las matrículas</option>
                  {data.members.map((item) => (
                    <option key={item.enrollment.id} value={item.enrollment.id}>
                      {fullName(item.student)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Observaciones desde
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label>
                Observaciones hasta
                <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
            </div>
            {filterError && <p role="alert">{filterError}</p>}
            {!filterError && !history.length && (
              <p>
                {data.notes.length
                  ? 'Sin coincidencias para los filtros seleccionados.'
                  : 'Este grupo aún no tiene observaciones.'}
              </p>
            )}
            <ul className="school-list">
              {history.map((note) => {
                const member = data.members.find(
                  (item) => item.enrollment.id === note.enrollmentId,
                )!;
                const name = fullName(member.student);
                return (
                  <li key={note.id}>
                    <strong>{name}</strong>
                    <span>
                      {note.date} · {noteCategories[note.category]}
                    </span>
                    <span>{noteMemberCondition(member)}</span>
                    <p className="assignment-description">{note.body}</p>
                    <button
                      onClick={() => {
                        setSaved(false);
                        setDeleted(false);
                        setForm({ note });
                      }}
                    >
                      Editar observación de {name} del {note.date}
                    </button>
                    <button
                      onClick={async () => {
                        if (!repositories || deleting.current) return;
                        deleting.current = true;
                        if (
                          !window.confirm(
                            `Eliminar la observación privada de ${name} del ${note.date}. Esta acción no se puede deshacer. ¿Confirmar eliminación?`,
                          )
                        ) {
                          deleting.current = false;
                          return;
                        }
                        setRemoving(true);
                        setBusy(true);
                        setError('');
                        setSaved(false);
                        setDeleted(false);
                        try {
                          await repositories.deleteStudentNote(
                            { ...context, enrollmentId: note.enrollmentId },
                            note.id,
                            note,
                            true,
                          );
                          setDeleted(true);
                          await load();
                        } catch (cause) {
                          setError(
                            cause instanceof ValidationError || cause instanceof StorageError
                              ? cause.message
                              : 'No se pudo eliminar la observación. Reintenta la consulta antes de continuar.',
                          );
                        } finally {
                          deleting.current = false;
                          setRemoving(false);
                          setBusy(false);
                        }
                      }}
                    >
                      Eliminar observación de {name} del {note.date}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
      {form && data && (
        <NoteForm
          context={context}
          year={year}
          members={data.members}
          note={form.note}
          selectedId={enrollmentId}
          onCancel={() => {
            setForm(null);
            void load();
          }}
          onSaved={() => {
            setSaved(true);
            setForm(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

// The shared navigation guard has one owner at a time: list operations or the form.
function NotesOperationGuard({ busy }: { busy: boolean }) {
  useDraftGuard(false, busy, 'observaciones');
  return null;
}
