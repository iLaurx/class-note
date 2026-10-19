import { useRef, useState } from 'react';
import type { Group, SchoolYear } from '../../domain/models';
import { useWorkContext } from '../../app/useWorkContext';
import { SchoolYearForm } from './SchoolYearForm';
import { GroupForm } from '../groups/GroupForm';
export function SchoolManagement() {
  const { data, busy, run } = useWorkContext();
  const [yearId, setYearId] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<
    { kind: 'year'; year?: SchoolYear } | { kind: 'group'; year: SchoolYear; group?: Group } | null
  >(null);
  const [confirmation, setConfirmation] = useState<{ year: SchoolYear; group?: Group } | null>(
    null,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const done = () => {
    setForm(null);
    heading.current?.focus();
  };
  const year = data?.years.find((y) => y.id === yearId);
  const groups =
    data?.groups.filter((g) => g.schoolYearId === yearId && (showArchived || !g.archived)) ?? [];
  async function archive() {
    if (!confirmation) return;
    const { year, group } = confirmation;
    if (
      await run((r) =>
        group
          ? r.archiveGroup({ schoolYearId: year.id, groupId: group.id })
          : r.archiveSchoolYear(year.id),
      )
    ) {
      setConfirmation(null);
      heading.current?.focus();
    }
  }
  return (
    <section className="panel school-management" aria-busy={busy}>
      <h2 ref={heading} tabIndex={-1}>
        Ciclos escolares y grupos
      </h2>
      <p>Administra tus registros. Explorar un ciclo aquí no cambia el contexto de trabajo.</p>
      <label className="archive-filter">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => {
            setShowArchived(e.target.checked);
            setForm(null);
          }}
        />{' '}
        Mostrar archivados
      </label>
      {!data && (
        <p role="status">
          Espera la carga del contexto o utiliza Reintentar contexto si hubo un error.
        </p>
      )}
      {data && (
        <>
          {data.years.length === 0 && (
            <p>Primero crea un ciclo escolar y después agrega sus grupos.</p>
          )}
          <button disabled={busy || !!confirmation} onClick={() => setForm({ kind: 'year' })}>
            Crear ciclo escolar
          </button>
          <ul className="school-list">
            {data.years
              .filter((y) => showArchived || !y.archived)
              .map((y) => (
                <li key={y.id}>
                  <strong>
                    {y.label}
                    {y.archived ? ' · Archivado' : ''}
                  </strong>
                  <span>
                    {y.startDate} — {y.endDate}
                  </span>
                  <div>
                    <button
                      disabled={busy || !!confirmation}
                      onClick={() => {
                        setYearId(y.id);
                        setForm(null);
                      }}
                    >
                      Ver grupos de {y.label}
                    </button>
                    {y.archived ? (
                      <button
                        disabled={busy}
                        onClick={() => void run((r) => r.reactivateSchoolYear(y.id))}
                      >
                        Reactivar ciclo {y.label}
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={busy || !!confirmation}
                          onClick={() => setForm({ kind: 'year', year: y })}
                        >
                          Editar ciclo {y.label}
                        </button>
                        <button
                          disabled={busy || !!form}
                          onClick={() => setConfirmation({ year: y })}
                        >
                          Archivar ciclo {y.label}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
          </ul>
          {!showArchived && data.years.some((y) => y.archived) && (
            <p>Hay ciclos archivados ocultos. Activa «Mostrar archivados» para consultarlos.</p>
          )}
          {year && (showArchived || !year.archived) && (
            <section aria-label={`Grupos de ${year.label}`}>
              <h3>Grupos de {year.label}</h3>
              {year.archived ? (
                <p>Reactiva el ciclo para editar o reactivar sus grupos.</p>
              ) : (
                <button
                  disabled={busy || !!confirmation}
                  onClick={() => setForm({ kind: 'group', year })}
                >
                  Crear grupo
                </button>
              )}
              {groups.length === 0 && (
                <p>No hay grupos visibles en este ciclo. Crea un grupo o muestra los archivados.</p>
              )}
              <ul className="school-list">
                {groups.map((g) => (
                  <li key={g.id}>
                    <strong>
                      {g.grade}.º {g.name}
                      {g.archived ? ' · Archivado' : ''}
                    </strong>
                    <span>{g.shift}</span>
                    <div>
                      {g.archived ? (
                        <button
                          disabled={busy || year.archived}
                          onClick={() =>
                            void run((r) =>
                              r.reactivateGroup({ schoolYearId: year.id, groupId: g.id }),
                            )
                          }
                        >
                          Reactivar grupo {g.name}
                        </button>
                      ) : (
                        <>
                          <button
                            disabled={busy || year.archived || !!confirmation}
                            onClick={() => setForm({ kind: 'group', year, group: g })}
                          >
                            Editar grupo {g.name}
                          </button>
                          <button
                            disabled={busy || year.archived || !!form}
                            onClick={() => setConfirmation({ year, group: g })}
                          >
                            Archivar grupo {g.name}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {form?.kind === 'year' && (
        <SchoolYearForm key={form.year?.id ?? 'new-year'} year={form.year} done={done} />
      )}
      {form?.kind === 'group' && (
        <GroupForm
          key={form.group?.id ?? form.year.id}
          year={form.year}
          group={form.group}
          done={done}
        />
      )}
      {confirmation && (
        <div className="school-form" role="region" aria-label="Confirmar archivo">
          <h3>
            Archivar{' '}
            {confirmation.group
              ? `${confirmation.group.grade}.º ${confirmation.group.name}`
              : confirmation.year.label}
          </h3>
          <p>Se conserva todo el historial. Puedes reactivar este registro después.</p>
          {(confirmation.group
            ? data?.selection.groupId === confirmation.group.id
            : data?.selection.schoolYearId === confirmation.year.id) && (
            <p>Este registro se retirará de tu selección de trabajo.</p>
          )}
          <button autoFocus disabled={busy} onClick={() => void archive()}>
            Confirmar archivo
          </button>{' '}
          <button
            disabled={busy}
            onClick={() => {
              setConfirmation(null);
              heading.current?.focus();
            }}
          >
            Cancelar archivo
          </button>
        </div>
      )}
    </section>
  );
}
