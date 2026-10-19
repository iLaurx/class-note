import { useStorage } from './useStorage';

export function StorageNotice() {
  const { state, retry } = useStorage();
  return (
    <aside className="storage-notice" aria-label="Almacenamiento local">
      {state.status === 'loading' && <p role="status">Abriendo almacenamiento local…</p>}
      {state.status === 'error' && (
        <div role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={() => void retry()}>
            Reintentar almacenamiento
          </button>
        </div>
      )}
      {state.status === 'ready' && <p role="status">Almacenamiento local listo.</p>}
      <p>
        Los datos se guardan en este equipo. Protege tu sesión de Windows y conserva respaldos fuera
        de la aplicación. La función de respaldos está en preparación.
      </p>
    </aside>
  );
}
