import { useRef, useState } from 'react';
import { useStorage } from '../../app/useStorage';
import { allowNavigation } from '../../app/pendingChanges';
import type { GroupContext } from '../../db/repositories';
import type { ReadingLog, SchoolYear } from '../../domain/models';
import { StorageError } from '../../db/errors';
import { ValidationError } from '../../domain/validation';
import { defaultDate } from '../attendance/attendanceDomain';
import { useDraftGuard } from '../assignments/useDraftGuard';
import { fullName } from '../students/studentPresentation';
import { memberCondition, type ReadingMember } from './readingDomain';

export function ReadingForm({
  context,
  year,
  members,
  reading,
  selectedId,
  onSaved,
  onCancel,
}: {
  context: GroupContext;
  year: SchoolYear;
  members: ReadingMember[];
  reading: ReadingLog | null;
  selectedId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { repositories } = useStorage();
  const [initial] = useState(() => ({
    enrollmentId: reading?.enrollmentId ?? selectedId,
    date: reading?.date ?? defaultDate(year),
    title: reading?.title ?? '',
    minutes: String(reading?.minutes ?? 0),
    comment: reading?.comment ?? '',
  }));
  const [fields, setFields] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const [saved, setSaved] = useState(false);
  const dirty =
    !saved &&
    Object.entries(fields).some(([key, value]) => initial[key as keyof typeof initial] !== value);
  useDraftGuard(dirty, busy, 'lectura');
  const member = members.find((item) => item.enrollment.id === fields.enrollmentId);
  return (
    <form
      className="school-form"
      aria-label={reading ? 'Editar lectura' : 'Registrar lectura'}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!repositories || locked.current || saved) return;
        locked.current = true;
        if (
          reading &&
          dirty &&
          !window.confirm(
            `Se corregirá una lectura de ${member ? fullName(member.student) : 'esta matrícula'} del ${reading.date}. ¿Guardar la corrección del historial?`,
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
            minutes: fields.minutes.trim() === '' ? NaN : Number(fields.minutes),
            comment: fields.comment.trim() || undefined,
          };
          if (reading) await repositories.updateReadingLog(destination, reading.id, input, reading);
          else await repositories.createReadingLog(destination, input);
          setSaved(true);
          onSaved();
        } catch (cause) {
          setError(
            cause instanceof ValidationError || cause instanceof StorageError
              ? cause.message
              : 'No se pudo guardar la lectura. Los campos se conservan.',
          );
        } finally {
          locked.current = false;
          setBusy(false);
        }
      }}
    >
      <h3>{reading ? 'Editar lectura' : 'Registrar lectura'}</h3>
      {error && <p role="alert">{error}</p>}
      {dirty && <p role="status">Cambios de lectura sin guardar</p>}
      <label>
        Alumno / matrícula
        <select
          aria-label="Alumno / matrícula"
          autoFocus={!reading}
          required
          disabled={busy || !!reading}
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
      {member && <p>{memberCondition(member)}</p>}
      {reading && <p>La matrícula propietaria se conserva al editar.</p>}
      <label>
        Fecha de lectura
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
        Título o texto leído
        <input
          autoFocus={!!reading}
          required
          disabled={busy}
          value={fields.title}
          onChange={(event) => setFields({ ...fields, title: event.target.value })}
        />
      </label>
      <label>
        Minutos
        <input
          type="number"
          required
          min={0}
          max={1440}
          step={1}
          disabled={busy}
          value={fields.minutes}
          onChange={(event) => setFields({ ...fields, minutes: event.target.value })}
        />
      </label>
      <p>De 0 a 1440 minutos por entrada. Puedes registrar varias lecturas el mismo día.</p>
      <label>
        Comentario (opcional)
        <textarea
          aria-label="Comentario (opcional)"
          disabled={busy}
          value={fields.comment}
          onChange={(event) => setFields({ ...fields, comment: event.target.value })}
        />
      </label>
      <button type="submit" disabled={busy || saved}>
        Guardar lectura
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (allowNavigation()) onCancel();
        }}
      >
        Cancelar lectura
      </button>
    </form>
  );
}
