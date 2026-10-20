import { useRef, useState } from 'react';
import type { Assignment, SchoolYear } from '../../domain/models';
import type { GroupContext } from '../../db/repositories';
import { useStorage } from '../../app/useStorage';
import { allowNavigation } from '../../app/pendingChanges';
import { defaultDate } from '../attendance/attendanceDomain';
import { StorageError } from '../../db/errors';
import { ValidationError } from '../../domain/validation';
import { useDraftGuard } from './useDraftGuard';

export function AssignmentForm({
  context,
  year,
  assignment,
  onSaved,
  onCancel,
}: {
  context: GroupContext;
  year: SchoolYear;
  assignment: Assignment | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { repositories } = useStorage();
  const [initial] = useState(() => ({
    title: assignment?.title ?? '',
    description: assignment?.description ?? '',
    assignedDate: assignment?.assignedDate ?? defaultDate(year),
    dueDate: assignment?.dueDate ?? '',
  }));
  const [fields, setFields] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const [saved, setSaved] = useState(false);
  const dirty =
    !saved &&
    Object.entries(fields).some(([key, value]) => value !== initial[key as keyof typeof initial]);
  useDraftGuard(dirty, busy);
  return (
    <form
      className="school-form"
      aria-label={assignment ? 'Editar tarea' : 'Crear tarea'}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!repositories || locked.current) return;
        locked.current = true;
        setBusy(true);
        setError('');
        try {
          const input = {
            ...fields,
            description: fields.description.trim() || undefined,
            dueDate: fields.dueDate || undefined,
          };
          if (assignment) await repositories.updateAssignment(context, assignment.id, input);
          else await repositories.createAssignment(context, input);
          setSaved(true);
          onSaved();
        } catch (cause) {
          setError(
            cause instanceof StorageError || cause instanceof ValidationError
              ? cause.message
              : 'No se pudo guardar la tarea. Los campos se conservan.',
          );
        } finally {
          locked.current = false;
          setBusy(false);
        }
      }}
    >
      <h3>{assignment ? 'Editar tarea' : 'Crear tarea'}</h3>
      {error && <p role="alert">{error}</p>}
      {dirty && <p role="status">Cambios de tarea sin guardar</p>}
      <label>
        Título
        <input
          autoFocus
          required
          value={fields.title}
          disabled={busy}
          onChange={(event) => setFields({ ...fields, title: event.target.value })}
        />
      </label>
      <label>
        Descripción (opcional)
        <textarea
          aria-label="Descripción (opcional)"
          value={fields.description}
          disabled={busy}
          onChange={(event) => setFields({ ...fields, description: event.target.value })}
        />
      </label>
      <label>
        Fecha de asignación
        <input
          type="date"
          required
          min={year.startDate}
          max={year.endDate}
          value={fields.assignedDate}
          disabled={busy}
          onChange={(event) => setFields({ ...fields, assignedDate: event.target.value })}
        />
      </label>
      <label>
        Fecha de entrega (opcional)
        <input
          type="date"
          min={fields.assignedDate || year.startDate}
          max={year.endDate}
          value={fields.dueDate}
          disabled={busy}
          onChange={(event) => setFields({ ...fields, dueDate: event.target.value })}
        />
      </label>
      <button disabled={busy} type="submit">
        Guardar tarea
      </button>
      <button
        disabled={busy}
        type="button"
        onClick={() => {
          if (allowNavigation()) onCancel();
        }}
      >
        Cancelar tarea
      </button>
    </form>
  );
}
