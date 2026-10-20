import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { navigation } from '../../app/navigation';
import { useStorage } from '../../app/useStorage';
import { useWorkContext } from '../../app/useWorkContext';
import { SectionLink } from '../../components/ui/SectionLink';
import type { GroupContext, Repositories } from '../../db/repositories';
import { attendanceLabels } from '../attendance/attendanceDomain';
import { localDay } from './dashboardDomain';

export function Dashboard() {
  const { data, busy, error } = useWorkContext();
  const { state } = useStorage();
  const year = data?.years.find((row) => row.id === data.selection.schoolYearId);
  const group = data?.groups.find((row) => row.id === data.selection.groupId);
  const [today, setToday] = useState(localDay);
  useEffect(() => {
    const refresh = () => setToday(localDay());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return (
    <div className="dashboard">
      <section className="welcome-banner" aria-labelledby="welcome-title">
        <div>
          <p className="eyebrow">TU DÍA ESCOLAR</p>
          <h2 id="welcome-title">¡Qué gusto tenerte aquí!</h2>
          <p>
            Resumen del grupo seleccionado · <time dateTime={today}>{today}</time>
          </p>
          {!busy && !error && year && group && (
            <p>
              {group.grade}.º {group.name} · Ciclo {year.label}
            </p>
          )}
        </div>
        <BookOpen className="welcome-book" size={100} strokeWidth={1} aria-hidden="true" />
      </section>
      {state.status === 'loading' || busy ? (
        <p role="status">Cargando resumen…</p>
      ) : state.status === 'error' || error ? (
        <p>El resumen no está disponible. Reintenta desde el aviso de almacenamiento o contexto.</p>
      ) : !year || !group ? (
        <p>Selecciona un ciclo y un grupo para consultar el resumen.</p>
      ) : (
        <DashboardSummary
          key={`${year.id}:${group.id}:${today}`}
          context={{ schoolYearId: year.id, groupId: group.id }}
          today={today}
        />
      )}
      <section aria-labelledby="quick-title">
        <div className="section-heading">
          <h2 id="quick-title">¿Por dónde empezamos?</h2>
          <span>Tus accesos rápidos</span>
        </div>
        <div className="quick-grid">
          {navigation
            .filter((item) =>
              ['attendance', 'assignments', 'reading', 'students'].includes(item.id),
            )
            .map((item) => (
              <SectionLink key={item.id} item={item} />
            ))}
        </div>
      </section>
    </div>
  );
}

function DashboardSummary({ context, today }: { context: GroupContext; today: string }) {
  const { repositories } = useStorage();
  const [data, setData] = useState<Awaited<ReturnType<Repositories['loadDashboard']>> | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { schoolYearId, groupId } = context;
  useEffect(() => {
    let cancelled = false;
    if (repositories)
      void repositories.loadDashboard({ schoolYearId, groupId }, today).then(
        (result) => {
          if (!cancelled) setData(result);
        },
        () => {
          if (!cancelled) setError(true);
        },
      );
    return () => {
      cancelled = true;
    };
  }, [repositories, schoolYearId, groupId, today, attempt]);
  if (error)
    return (
      <div role="alert">
        <p>No se pudo consultar el resumen.</p>
        <button
          onClick={() => {
            setError(false);
            setAttempt((value) => value + 1);
          }}
        >
          Reintentar resumen
        </button>
      </div>
    );
  if (!data) return <p role="status">Cargando resumen…</p>;
  return (
    <section aria-label="Resumen del grupo">
      <div className="section-heading">
        <h2>Un vistazo a tu grupo</h2>
      </div>
      <div className="stats-grid">
        <article className="stat-card panel" aria-label="Matrículas de hoy">
          <h3>Alumnos al {today}</h3>
          {data.inYear ? (
            <>
              <strong className="stat-number">{data.students}</strong>
              <p>
                {data.students
                  ? 'Matrículas aplicables hoy (intervalos inclusivos).'
                  : 'Sin matrículas aplicables hoy.'}
              </p>
            </>
          ) : (
            <p>Hoy está fuera del ciclo escolar. No hay población aplicable hoy.</p>
          )}
          <a href="#/alumnos">Ver alumnos</a>
        </article>
        <article className="stat-card panel" aria-label="Asistencia de hoy">
          <h3>Asistencia del {today}</h3>
          {!data.attendance ? (
            <p>Hoy está fuera del ciclo escolar.</p>
          ) : !data.students ? (
            <p>Sin matrículas aplicables hoy.</p>
          ) : (
            <>
              {data.attendance.unregistered === data.students && (
                <p>Aún no hay asistencia registrada hoy.</p>
              )}
              <ul>
                {(['present', 'absent', 'late', 'excused'] as const).map((status) => (
                  <li key={status}>
                    {attendanceLabels[status]}: {data.attendance![status]}
                  </li>
                ))}
                <li>Sin registrar: {data.attendance.unregistered}</li>
              </ul>
            </>
          )}
          <a href="#/asistencia">Ver asistencia</a>
        </article>
        <article className="stat-card panel" aria-label="Lecturas de la semana">
          <h3>Lecturas de esta semana</h3>
          <p>
            Del {data.reading.from} al {data.reading.to} · lunes a domingo
          </p>
          {data.reading.count ? (
            <p>
              {data.reading.minutes} minutos · {data.reading.count} registros
            </p>
          ) : (
            <p>Sin lecturas registradas esta semana.</p>
          )}
          <a href="#/lectura">Ver lecturas</a>
        </article>
      </div>
      <section className="panel assignments-panel mt-6" aria-labelledby="agenda-title">
        <h3 id="agenda-title">En la agenda</h3>
        <p>
          Asignadas del {data.recentFrom} al {today}, o con entrega del {today} al {data.upcomingTo}
          .
        </p>
        {!data.assignments.length ? (
          <p>Sin tareas asignadas recientemente ni con entrega próxima.</p>
        ) : (
          <>
            <p>{data.assignments.length} tareas en este periodo · se muestran hasta 5.</p>
            <ul className="assignment-list">
              {data.assignments.slice(0, 5).map((row) => (
                <li key={row.id}>
                  <div className="min-w-0 break-words">
                    <h4>{row.title}</h4>
                    <p>
                      Asignada: {row.assignedDate} ·{' '}
                      {row.dueDate ? `Entrega: ${row.dueDate}` : 'Sin fecha de entrega'}
                    </p>
                    <p>
                      {row.population
                        ? `${row.pending} pendientes de ${row.population} matrículas aplicables al ${row.assignedDate}`
                        : 'Sin matrículas aplicables a la fecha de asignación.'}
                    </p>
                    {!!row.incidents && (
                      <p>
                        {row.incidents} entregas fuera de la población actual; consulta las
                        incidencias en Tareas.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <a className="text-link mb-4" href="#/tareas">
          Ver todas las tareas
        </a>
      </section>
    </section>
  );
}
