import { useWorkContext } from './useWorkContext';
export function WorkContextSelector() {
  const { data, busy, error, run } = useWorkContext();
  const selection = data?.selection;
  return (
    <section className="panel work-selector" aria-label="Contexto de trabajo" aria-busy={busy}>
      <strong>Contexto de trabajo</strong>
      {error && (
        <div role="alert">
          {error} <button onClick={() => void run()}>Reintentar contexto</button>
        </div>
      )}
      <label>
        <span id="work-year-label">Ciclo de trabajo</span>
        <select
          aria-labelledby="work-year-label"
          disabled={busy || !data}
          value={selection?.schoolYearId ?? ''}
          onChange={(e) =>
            void run((r) =>
              r.selectContext({ schoolYearId: e.target.value || null, groupId: null }),
            )
          }
        >
          <option value="">Sin ciclo seleccionado</option>
          {data?.years
            .filter((y) => !y.archived)
            .map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
        </select>
      </label>
      <label>
        <span id="work-group-label">Grupo de trabajo</span>
        <select
          aria-labelledby="work-group-label"
          disabled={busy || !selection?.schoolYearId}
          value={selection?.groupId ?? ''}
          onChange={(e) =>
            void run((r) =>
              r.selectContext({
                schoolYearId: selection?.schoolYearId,
                groupId: e.target.value || null,
              }),
            )
          }
        >
          <option value="">Sin grupo seleccionado</option>
          {data?.groups
            .filter((g) => !g.archived && g.schoolYearId === selection?.schoolYearId)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.grade}.º {g.name}
              </option>
            ))}
        </select>
      </label>
      {busy && <p role="status">Cargando contexto…</p>}
    </section>
  );
}
