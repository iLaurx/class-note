import { useRef, useState } from 'react';
import { useStorage } from '../../app/useStorage';
import { allowNavigation } from '../../app/pendingChanges';
import type { GroupContext } from '../../db/repositories';
import type { StudentNote, SchoolYear } from '../../domain/models';
import { StorageError } from '../../db/errors';
import { ValidationError } from '../../domain/validation';
import { defaultDate } from '../attendance/attendanceDomain';
import { useDraftGuard } from '../assignments/useDraftGuard';
import { fullName } from '../students/studentPresentation';
import { noteCategories, noteMemberCondition, type NoteMember } from './notesDomain';

export function NoteForm({
  context,
  year,
  members,
  note,
  selectedId,
  onSaved,
  onCancel,
}: {
  context: GroupContext;
  year: SchoolYear;
  members: NoteMember[];
  note: StudentNote | null;
  selectedId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { repositories } = useStorage();
  const [initial] = useState(() => ({
    enrollmentId: note?.enrollmentId ?? selectedId,
    date: note?.date ?? defaultDate(year),
    category: note?.category ?? 'academic',
    body: note?.body ?? '',
  }));
  const [fields, setFields] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const [saved, setSaved] = useState(false);
  const dirty =
    !saved &&
    Object.entries(fields).some(([key, value]) => initial[key as keyof typeof initial] !== value);
  useDraftGuard(dirty, busy, 'observación');
  const member = members.find((item) => item.enrollment.id === fields.enrollmentId);
  return (
    <form
      className="school-form"
      aria-label={note ? 'Editar observación' : 'Registrar observación'}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!repositories || locked.current || saved) return;
        locked.current = true;
        if (
          note &&
          dirty &&
          !window.confirm(
            `Se corregirá una observación de ${member ? fullName(member.student) : 'esta matrícula'} del ${note.date}. ¿Guardar la corrección del historial?`,
          )
        ) {
          locked.current = false;
          return;
        }
        setBusy(true);
        setError('');
        try {
          const destination = { ...context, enrollmentId: fields.enrollmentId };
          const input = {
            ...fields,
          };
          if (note) await repositories.updateStudentNote(destination, note.id, input, note);
          else await repositories.createStudentNote(destination, input);
          setSaved(true);
          onSaved();
        } catch (cause) {
          setError(
            cause instanceof ValidationError || cause instanceof StorageError
              ? cause.message
              : 'No se pudo guardar la observación. Los campos se conservan.',
          );
        } finally {
          locked.current = false;
          setBusy(false);
        }
      }}
    >
      <h3>{note ? 'Editar observación' : 'Registrar observación'}</h3>
      {error && <p role="alert">{error}</p>}
      {dirty && <p role="status">Cambios de observación sin guardar</p>}
      <label>
        Alumno / matrícula
        <select
          aria-label="Alumno / matrícula"
          autoFocus={!note}
          required
          disabled={busy || !!note}
          value={fields.enrollmentId}
          onChange={(event) => setFields({ ...fields, enrollmentId: event.target.value })}
        >
          <option value="">Selecciona una matrícula</option>
          {members.map((item) => (
            <option key={item.enrollment.id} value={item.enrollment.id}>
              {fullName(item.student)}
            </option>
          ))}
        </select>
      </label>
      {member && <p>{noteMemberCondition(member)}</p>}
      {note && <p>La matrícula propietaria se conserva al editar.</p>}
      <label>
        Fecha de observación
        <input
          type="date"
          required
          min={member?.enrollment.joinedAt ?? year.startDate}
          max={member?.enrollment.leftAt ?? year.endDate}
          disabled={busy}
          value={fields.date}
          onChange={(event) => setFields({ ...fields, date: event.target.value })}
        />
      </label>
      <label>
        Categoría
        <select
          aria-label="Categoría"
          autoFocus={!!note}
          disabled={busy}
          value={fields.category}
          onChange={(event) =>
            setFields({ ...fields, category: event.target.value as StudentNote['category'] })
          }
        >
          {Object.entries(noteCategories).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Texto de la observación
        <textarea
          required
          disabled={busy}
          value={fields.body}
          onChange={(event) => setFields({ ...fields, body: event.target.value })}
        />
      </label>
      <button type="submit" disabled={busy || saved}>
        Guardar observación
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (allowNavigation()) onCancel();
        }}
      >
        Cancelar observación
      </button>
    </form>
  );
}
