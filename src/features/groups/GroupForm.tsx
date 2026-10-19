import { useState, type SubmitEvent } from 'react';
import type { Group, SchoolYear } from '../../domain/models';
import { useWorkContext } from '../../app/useWorkContext';
export function GroupForm({
  year,
  group,
  done,
}: {
  year: SchoolYear;
  group?: Group;
  done: () => void;
}) {
  const { busy, run } = useWorkContext();
  const [grade, setGrade] = useState(group?.grade ?? 1);
  const [name, setName] = useState(group?.name ?? '');
  const [shift, setShift] = useState(group?.shift ?? '');
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { schoolYearId: year.id, grade, name, shift: shift.trim() || undefined };
    if (
      await run((r) =>
        group
          ? r.updateGroup({ schoolYearId: year.id, groupId: group.id }, input)
          : r.createGroup(input),
      )
    )
      done();
  }
  return (
    <form
      className="school-form"
      aria-label={group ? 'Editar grupo' : 'Crear grupo'}
      onSubmit={save}
    >
      <h3>
        {group ? 'Editar grupo' : 'Crear grupo'} · {year.label}
      </h3>
      <p>Para cambiar de ciclo, crea otro grupo. Así se conserva el historial.</p>
      <label>
        Grado
        <select autoFocus value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}.º
            </option>
          ))}
        </select>
      </label>
      <label>
        Nombre del grupo
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Turno (opcional)
        <input value={shift} onChange={(e) => setShift(e.target.value)} />
      </label>
      <div>
        <button disabled={busy} type="submit">
          Guardar grupo
        </button>{' '}
        <button disabled={busy} type="button" onClick={done}>
          Cancelar formulario
        </button>
      </div>
    </form>
  );
}
