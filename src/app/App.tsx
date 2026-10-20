import { Observations } from '../features/notes/Observations';
import { Reports } from '../features/reports/Reports';
import { Assignments } from '../features/assignments/Assignments';
import { Reading } from '../features/reading/Reading';
import { Students } from '../features/students/Students';
import { Attendance } from '../features/attendance/Attendance';
import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Dashboard } from '../features/dashboard/Dashboard';
import { ModulePlaceholder } from '../features/ModulePlaceholder';
import { useNavigation } from './useNavigation';
import { StorageNotice } from './StorageNotice';
import { WorkContextSelector } from './WorkContextSelector';
import { SchoolManagement } from '../features/school-years/SchoolManagement';
import { BackupRestore } from '../features/settings/BackupRestore';

export function App() {
  const current = useNavigation();
  const [settingsRevision, setSettingsRevision] = useState(0);
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
        {current?.id === 'home' ? (
          <Dashboard />
        ) : current?.id === 'students' ? (
          <Students />
        ) : current?.id === 'attendance' ? (
          <Attendance />
        ) : current?.id === 'assignments' ? (
          <Assignments />
        ) : current?.id === 'reading' ? (
          <Reading />
        ) : current?.id === 'notes' ? (
          <Observations />
        ) : current?.id === 'settings' ? (
          <>
            <BackupRestore onRestored={() => setSettingsRevision((value) => value + 1)} />
            <SchoolManagement key={settingsRevision} />
          </>
        ) : current?.id === 'reports' ? (
          <Reports />
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
