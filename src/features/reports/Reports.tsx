import { useEffect, useRef, useState } from 'react';
import { useStorage } from '../../app/useStorage';
import { useWorkContext } from '../../app/useWorkContext';
import type { GroupContext } from '../../db/repositories';
import { reportRange } from '../../services/export/reportRange';

export function Reports() {
  const { data, busy, error } = useWorkContext();
  const { state } = useStorage();
  const year = data?.years.find((row) => row.id === data.selection.schoolYearId);
  const group = data?.groups.find((row) => row.id === data.selection.groupId);
  return (
    <section className="school-management panel assignments-panel" aria-labelledby="reports-title">
      <h2 id="reports-title">Reportes del grupo</h2>
      <p>
        Exporta Alumnos, Asistencia, Tareas y Lecturas. El Excel es un reporte, no un respaldo
        restaurable. No incluye observaciones privadas ni ajustes internos.
      </p>
      <p>
        Alumnos incluye todas las matrículas del grupo, independientemente del rango. El rango
        incluye ambos extremos y filtra asistencia por fecha, tareas por fecha de asignación y
        lecturas por fecha.
      </p>
      <p>Protege el archivo exportado: contiene información del grupo.</p>
      {busy || state.status === 'loading' ? (
        <p role="status">Cargando contexto…</p>
      ) : error || state.status === 'error' ? (
        <p>Reintenta desde el aviso de almacenamiento o contexto.</p>
      ) : !year || !group ? (
        <p>Selecciona un ciclo y un grupo para exportar.</p>
      ) : (
        <ReportForm
          key={`${year.id}:${group.id}`}
          context={{ schoolYearId: year.id, groupId: group.id }}
          startDate={year.startDate}
          endDate={year.endDate}
          label={`${group.grade}.º ${group.name} · Ciclo ${year.label}`}
        />
      )}
    </section>
  );
}

function ReportForm({
  context,
  startDate,
  endDate,
  label,
}: {
  context: GroupContext;
  startDate: string;
  endDate: string;
  label: string;
}) {
  const { repositories } = useStorage();
  const [from, setFrom] = useState(startDate),
    [to, setTo] = useState(endDate);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const locked = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <form
      className="school-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (locked.current || !repositories) return;
        setMessage('');
        setError('');
        try {
          reportRange(from, to);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Revisa las fechas.');
          return;
        }
        locked.current = true;
        setBusy(true);
        void (async () => {
          try {
            const data = await repositories.loadGroupReport(context, from, to);
            const { groupWorkbook } = await import('../../services/export/groupWorkbook');
            const bytes = await groupWorkbook(data);
            if (!active.current) return;
            const { saveReport } = await import('../../lib/tauri/saveReport');
            if (!active.current) return;
            const saved = await saveReport(bytes);
            if (active.current)
              setMessage(
                saved
                  ? 'Reporte Excel guardado.'
                  : 'Exportación cancelada. No se escribió ningún archivo.',
              );
          } catch (cause) {
            if (active.current)
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'No se pudo exportar el reporte. Reintenta.',
              );
          } finally {
            locked.current = false;
            if (active.current) setBusy(false);
          }
        })();
      }}
    >
      <p>{label}</p>
      <label>
        Desde
        <input
          type="date"
          value={from}
          required
          disabled={busy}
          onChange={(event) => {
            setFrom(event.target.value);
            setMessage('');
            setError('');
          }}
        />
      </label>
      <label>
        Hasta
        <input
          type="date"
          value={to}
          required
          disabled={busy}
          onChange={(event) => {
            setTo(event.target.value);
            setMessage('');
            setError('');
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <p role="status">{busy ? 'Preparando reporte…' : message}</p>
      <button type="submit" className="button-primary" disabled={busy}>
        {busy ? 'Exportando…' : 'Exportar Excel'}
      </button>
    </form>
  );
}
