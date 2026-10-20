import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkContext } from '../../app/useWorkContext';
import { useStorage } from '../../app/useStorage';
import type { SchoolYear, ReadingLog } from '../../domain/models';
import type { Repositories } from '../../db/repositories';
import { fullName } from '../students/studentPresentation';
import { defaultDate } from '../attendance/attendanceDomain';
import { memberCondition, readingHistory, weeklyReadings } from './readingDomain';
import { ReadingForm } from './ReadingForm';

export function Reading() {
  const { data } = useWorkContext();
  const year = data?.years.find((item) => item.id === data.selection.schoolYearId);
  const groupId = data?.selection.groupId;
  return (
    <section className="attendance assignments" aria-label="Lecturas del grupo">
      <h2>Lecturas del grupo</h2>
      <a href="#/inicio">Volver a Inicio</a>
      {!year || !groupId ? (
        <p>Selecciona un ciclo y un grupo para registrar lecturas.</p>
      ) : (
        <ReadingWorkspace key={`${year.id}:${groupId}`} year={year} groupId={groupId} />
      )}
    </section>
  );
}
function ReadingWorkspace({ year, groupId }: { year: SchoolYear; groupId: string }) {
  const { repositories } = useStorage();
  const context = useMemo(() => ({ schoolYearId: year.id, groupId }), [year.id, groupId]);
  const [data, setData] = useState<Awaited<ReturnType<Repositories['loadReadingGroup']>> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<{ reading: ReadingLog | null } | null>(null);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [weekDate, setWeekDate] = useState(defaultDate(year) || year.startDate);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    if (!repositories) return;
    const token = ++sequence.current;
    setBusy(true);
    setError('');
    try {
      const next = await repositories.loadReadingGroup(context);
      if (sequence.current === token) setData(next);
    } catch {
      if (sequence.current === token) {
        setData(null);
        setError('No se pudieron consultar las lecturas. Reintenta solo la lectura.');
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
  let history: ReadingLog[] = [];
  let filterError = '';
  let summary: ReturnType<typeof weeklyReadings> | null = null;
  try {
    history = readingHistory(data?.logs ?? [], enrollmentId, from, to);
  } catch {
    filterError = 'Elige fechas reales y un rango de historial ordenado.';
  }
  try {
    if (weekDate && data) summary = weeklyReadings(data.members, data.logs, weekDate);
  } catch {
    /* Date field may be incomplete. */
  }
  const member = data?.members.find((item) => item.enrollment.id === enrollmentId);
  return (
    <div aria-busy={busy}>
      {saved && <p role="status">La lectura se guardó.</p>}
      {busy && <p role="status">Cargando lecturas…</p>}
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
            <p>Este grupo aún no tiene matrículas. Agrega alumnos para registrar lecturas.</p>
          ) : (
            <button
              onClick={() => {
                setSaved(false);
                setForm({ reading: null });
              }}
            >
              Registrar lectura
            </button>
          )}
          <section aria-label="Historial individual">
            <h3>Historial individual</h3>
            <div className="assignment-filters">
              <label>
                Matrícula del historial
                <select
                  aria-label="Matrícula del historial"
                  value={enrollmentId}
                  onChange={(event) => setEnrollmentId(event.target.value)}
                >
                  <option value="">Selecciona una matrícula</option>
                  {data.members.map((item) => (
                    <option key={item.enrollment.id} value={item.enrollment.id}>
                      {fullName(item.student)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lecturas desde
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label>
                Lecturas hasta
                <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
            </div>
            {member && <p>{memberCondition(member)}</p>}
            {filterError && <p role="alert">{filterError}</p>}
            {!enrollmentId ? (
              <p>Selecciona una matrícula para consultar su historial.</p>
            ) : (
              !filterError && !history.length && <p>Sin lecturas para esta matrícula y rango.</p>
            )}
            <ul className="school-list">
              {history.map((log) => (
                <li key={log.id}>
                  <strong>{log.title}</strong>
                  <span>
                    {log.date} · {log.minutes} minutos
                  </span>
                  {log.comment && <p className="assignment-description">{log.comment}</p>}
                  <button
                    onClick={() => {
                      setSaved(false);
                      setForm({ reading: log });
                    }}
                  >
                    Editar lectura {log.title} del {log.date}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Resumen semanal">
            <h3>Resumen semanal</h3>
            <label className="attendance-date">
              Fecha de la semana
              <input
                type="date"
                required
                value={weekDate}
                onChange={(event) => setWeekDate(event.target.value)}
              />
            </label>
            <p>
              Toda la semana seleccionada del grupo, independiente del filtro del historial. De
              lunes a domingo.
            </p>
            {!summary ? (
              <p>Elige una fecha real para consultar la semana.</p>
            ) : (
              <>
                <p>
                  Semana del {summary.from} al {summary.to}
                </p>
                <p role="status">
                  Total del grupo: {summary.minutes} minutos · {summary.count} registros
                </p>
                {!summary.count && <p>Sin lecturas en esta semana.</p>}
                <ul className="school-list">
                  {summary.rows.map((row) => (
                    <li key={row.enrollment.id}>
                      <strong>{fullName(row.student)}</strong>
                      <span>{memberCondition(row)}</span>
                      <span>
                        {row.minutes} minutos · {row.count} registros
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
      {form && data && (
        <ReadingForm
          context={context}
          year={year}
          members={data.members}
          reading={form.reading}
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
