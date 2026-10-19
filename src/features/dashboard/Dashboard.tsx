import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  Sun,
  UsersRound,
} from 'lucide-react';
import { navigation } from '../../app/navigation';
import { SectionLink } from '../../components/ui/SectionLink';
import { dashboardMock as demo } from './dashboard.mock';

export function Dashboard() {
  const attendancePercentage = Math.round((demo.present / demo.students) * 100);
  return (
    <div className="dashboard">
      <section className="welcome-banner" aria-labelledby="welcome-title">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Sun size={16} aria-hidden="true" />
            UN NUEVO DÍA PARA APRENDER
          </p>
          <h2 id="welcome-title">¡Qué gusto tenerte aquí!</h2>
          <p>Todo listo para acompañar a tu grupo, un día a la vez.</p>
          <div className="welcome-meta">
            <span>
              {demo.group} · Ciclo {demo.schoolYear}
            </span>
            <span className="demo-tag">Grupo de ejemplo</span>
          </div>
        </div>
        <BookOpen className="welcome-book" size={100} strokeWidth={1} aria-hidden="true" />
      </section>

      <div className="section-heading">
        <h2>Un vistazo a tu grupo</h2>
        <span className="sample-date">
          <CalendarDays size={15} aria-hidden="true" />
          <time dateTime={demo.date}>{demo.dateLabel}</time> · Ejemplo
        </span>
      </div>
      <section className="stats-grid" aria-label="Resumen de ejemplo">
        <article className="stat-card panel">
          <div className="stat-label">
            <span>Alumnos en el grupo</span>
            <UsersRound size={20} aria-hidden="true" />
          </div>
          <strong className="stat-number">{demo.students}</strong>
          <p>Un grupo lleno de posibilidades</p>
          <a href="#/alumnos">
            Ver alumnos <ArrowRight size={15} aria-hidden="true" />
          </a>
        </article>
        <article className="stat-card panel">
          <div className="stat-label">
            <span>Asistencia del día</span>
            <CalendarCheck size={20} aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-2">
            <strong className="stat-number">
              {demo.present}
              <span className="stat-denominator"> / {demo.students}</span>
            </strong>
            <span className="attendance-badge">{attendancePercentage}%</span>
          </div>
          <p>
            {demo.present} presentes · {demo.absent} ausentes
          </p>
          <a href="#/asistencia">
            Ver asistencia <ArrowRight size={15} aria-hidden="true" />
          </a>
        </article>
        <article className="stat-card panel">
          <div className="stat-label">
            <span>Tareas pendientes</span>
            <ClipboardList size={20} aria-hidden="true" />
          </div>
          <strong className="stat-number">{demo.pendingAssignments}</strong>
          <p>Actividades por revisar</p>
          <a href="#/tareas">
            Ver tareas <ArrowRight size={15} aria-hidden="true" />
          </a>
        </article>
      </section>

      <section aria-labelledby="quick-title">
        <div className="section-heading">
          <h2 id="quick-title">¿Por dónde empezamos?</h2>
          <span className="text-sm text-stone-600">Tus accesos rápidos</span>
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

      <div className="dashboard-bottom">
        <section className="panel assignments-panel" aria-labelledby="assignments-title">
          <div className="section-heading">
            <h2 id="assignments-title">En la agenda</h2>
            <a className="text-link" href="#/tareas">
              Ver tareas <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
          <p className="text-sm text-stone-600 mb-3">Una muestra de las próximas actividades.</p>
          <ul className="assignment-list">
            {demo.assignments.map((assignment) => (
              <li key={assignment.title}>
                <span className={`subject-dot subject-${assignment.tone}`} aria-hidden="true" />
                <div>
                  <h3>{assignment.title}</h3>
                  <p>{assignment.subject}</p>
                </div>
                <span className="due-label">{assignment.due}</span>
              </li>
            ))}
          </ul>
        </section>
        <aside className="reading-card" aria-labelledby="reading-title">
          <span className="icon-tile">
            <BookOpen size={23} aria-hidden="true" />
          </span>
          <p className="eyebrow mt-5">UN HÁBITO QUE CRECE</p>
          <h2 id="reading-title">Cada página cuenta.</h2>
          <p>Acompaña las pequeñas lecturas que hacen grandes lectores.</p>
          <a className="text-link" href="#/lectura">
            Ir a lectura en casa <ArrowRight size={16} aria-hidden="true" />
          </a>
        </aside>
      </div>
    </div>
  );
}
