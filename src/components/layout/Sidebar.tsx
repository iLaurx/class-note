import { BookOpen, ChevronDown, WifiOff } from 'lucide-react';
import { navigation, type NavigationItem } from '../../app/navigation';
import { dashboardMock } from '../../features/dashboard/dashboard.mock';

export function Sidebar({ current }: { current: NavigationItem | undefined }) {
  return (
    <aside className="sidebar">
      <a href="#/inicio" className="brand" aria-label="ClassNote, ir a Inicio">
        <span className="brand-mark">
          <BookOpen size={23} aria-hidden="true" />
        </span>
        <span>
          ClassNote<span className="brand-caption">TU AGENDA ESCOLAR</span>
        </span>
      </a>
      <div className="group-context">
        <span className="eyebrow">GRUPO DE EJEMPLO</span>
        <div className="mt-2 flex items-center justify-between gap-2">
          <strong>{dashboardMock.group}</strong>
          <span className="text-sm">{dashboardMock.schoolYear}</span>
        </div>
        <p className="mt-1 text-xs text-stone-600">{dashboardMock.shift}</p>
        <a href="#/configuracion" className="context-link">
          Ver configuración <ChevronDown size={14} aria-hidden="true" />
        </a>
      </div>
      <p className="nav-caption eyebrow">MI ESPACIO</p>
      <nav aria-label="Navegación principal" className="navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              href={item.href}
              aria-current={current?.id === item.id ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="flex items-center gap-2 font-medium text-emerald-900">
          <WifiOff size={16} aria-hidden="true" />
          Funciona sin internet
        </div>
        <p className="mt-2 text-xs leading-5 text-stone-600">Tu día escolar, a tu ritmo.</p>
        <p className="mt-4 text-xs text-stone-500">ClassNote · Vista de demostración</p>
      </div>
    </aside>
  );
}
