import { WifiOff } from 'lucide-react';
import type { NavigationItem } from '../../app/navigation';

export function Header({ current }: { current: NavigationItem | undefined }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow mb-1">MI AGENDA</p>
        <h1 id="page-title" tabIndex={-1}>
          {current?.label ?? 'Sección no encontrada'}
        </h1>
      </div>
      <span className="offline-badge">
        <WifiOff size={14} aria-hidden="true" />
        Sin conexión requerida
      </span>
    </header>
  );
}
