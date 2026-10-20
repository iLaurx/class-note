import { Students } from '../features/students/Students';
import { Attendance } from '../features/attendance/Attendance';
import { useEffect, useRef } from 'react';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Dashboard } from '../features/dashboard/Dashboard';
import { ModulePlaceholder } from '../features/ModulePlaceholder';
import { useNavigation } from './useNavigation';
import { StorageNotice } from './StorageNotice';
import { WorkContextSelector } from './WorkContextSelector';
import { SchoolManagement } from '../features/school-years/SchoolManagement';

export function App() {
  const current = useNavigation();
  const mainRef = useRef<HTMLElement>(null);
  const previousSection = useRef(current?.id);

  useEffect(() => {
    document.title = `${current?.label ?? 'Sección no encontrada'} · ClassNote`;
    if (previousSection.current !== current?.id) {
      mainRef.current?.querySelector<HTMLElement>('h1')?.focus();
      window.scrollTo(0, 0);
    }
    previousSection.current = current?.id;
  }, [current]);

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <Sidebar current={current} />
      <main id="main-content" ref={mainRef} tabIndex={-1} className="main-content">
        <Header current={current} />
        <StorageNotice />
        <WorkContextSelector />
        {current?.id === 'home' && (
          <div className="demo-notice">
            <span className="demo-tag">DEMOSTRACIÓN</span>
            <p>Todos los datos son ficticios. La demostración no se guarda en la base local.</p>
          </div>
        )}
        {current?.id === 'home' ? (
          <Dashboard />
        ) : current?.id === 'students' ? (
          <Students />
        ) : current?.id === 'attendance' ? (
          <Attendance />
        ) : current?.id === 'settings' ? (
          <SchoolManagement />
        ) : (
          <ModulePlaceholder section={current} />
        )}
        <footer className="page-footer">
          Hecho para el día a día de tu aula.
          <span>ClassNote · Sin cuentas ni servicios externos</span>
        </footer>
      </main>
    </div>
  );
}
