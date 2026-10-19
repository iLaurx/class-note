import { ArrowLeft } from 'lucide-react';
import type { NavigationItem } from '../app/navigation';

export function ModulePlaceholder({ section }: { section: NavigationItem | undefined }) {
  if (!section || !('preview' in section)) {
    return (
      <section className="placeholder panel">
        <h2>Esta sección no está disponible</h2>
        <p>El enlace no corresponde a una sección de ClassNote.</p>
        <a href="#/inicio" className="button-primary">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a Inicio
        </a>
      </section>
    );
  }
  const Icon = section.icon;
  return (
    <>
      <p className="section-intro">{section.description}</p>
      <section className="placeholder panel" aria-labelledby="module-title">
        <span className="placeholder-icon">
          <Icon size={30} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="demo-tag">EN PREPARACIÓN</span>
        <h2 id="module-title">Tu espacio de {section.label.toLocaleLowerCase('es-MX')}</h2>
        <p>{section.preview}</p>
        <p className="text-sm">
          Esta vista es una demostración. Todavía no permite registrar ni guardar información.
        </p>
        <a href="#/inicio" className="button-primary">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a Inicio
        </a>
      </section>
    </>
  );
}
