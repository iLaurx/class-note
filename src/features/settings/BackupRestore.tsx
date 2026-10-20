import { useEffect, useRef, useState } from 'react';
import { useStorage } from '../../app/useStorage';
import { useWorkContext } from '../../app/useWorkContext';
import { useDraftGuard } from '../assignments/useDraftGuard';
import { openBackup, saveBackup } from '../../lib/tauri/backupFiles';
import type { BackupPreview } from '../../services/backup/backupService';
import { TABLE_LABELS, TABLE_NAMES } from '../../services/backup/validation';

export function BackupRestore({ onRestored }: { onRestored: () => void }) {
  const { backup } = useStorage();
  const { run, busy: contextBusy } = useWorkContext();
  const [preview, setPreview] = useState<{ source: string; info: BackupPreview } | null>(null);
  const [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [committed, setCommitted] = useState(false);
  const locked = useRef(false),
    section = useRef<HTMLElement>(null);
  useDraftGuard(!!preview && !committed, busy, 'restauración');
  useEffect(() => {
    if (preview && !busy)
      section.current?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
  }, [preview, busy]);
  async function operate(action: () => Promise<void>) {
    if (locked.current || !backup) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await action();
    } catch {
      setError(
        'No se pudo completar la operación. El respaldo puede estar incompleto, ser incompatible o contener datos inválidos. Revisa también los permisos y el espacio disponible. La base no fue reemplazada.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    if (await run()) {
      setMessage('Restauración completada. Contexto y vistas recargados.');
      setCommitted(false);
    } else {
      setError(
        'Los datos fueron restaurados, pero no se pudo recargar el contexto. Reintenta solo la lectura.',
      );
    }
  }
  return (
    <section
      ref={section}
      className="panel school-management"
      aria-labelledby="backup-title"
      aria-busy={busy}
    >
      <h2 id="backup-title">Respaldo completo y restauración</h2>
      <p>
        El respaldo contiene todos los registros educativos locales, observaciones privadas y
        configuración de todos los ciclos y grupos. Permite recuperarlos. El reporte Excel no es un
        respaldo restaurable.
      </p>
      <p>
        Protege estos archivos y tu sesión de Windows. El respaldo no está cifrado. Elige una
        ubicación privada fuera del perfil de ClassNote; no borres tus copias anteriores.
      </p>
      <button
        disabled={!backup || busy || contextBusy || !!preview || committed}
        onClick={() =>
          void operate(async () => {
            if (await saveBackup(await backup!.export())) setMessage('Respaldo completo guardado.');
            else setMessage('Guardado cancelado.');
          })
        }
      >
        Guardar respaldo completo
      </button>{' '}
      <button
        disabled={!backup || busy || contextBusy || !!preview || committed}
        onClick={() =>
          void operate(async () => {
            const source = await openBackup();
            if (source === null) {
              setMessage('Selección cancelada.');
              return;
            }
            const info = await backup!.preview(source);
            setConfirmed(false);
            setPreview({ source, info });
          })
        }
      >
        Elegir respaldo para restaurar
      </button>
      {preview && (
        <div className="school-form" role="region" aria-label="Previsualización del respaldo">
          <h3>Previsualización del respaldo</h3>
          <p>
            Creado: {preview.info.createdAt} · Aplicación: {preview.info.appVersion} · Formato:{' '}
            {preview.info.formatVersion} · Esquema: {preview.info.schemaVersion}
          </p>
          <ul>
            {TABLE_NAMES.map((name) => (
              <li key={name}>
                {TABLE_LABELS[name]}: {preview.info.counts[name]}
              </li>
            ))}
          </ul>
          <p>
            Restaurar reemplaza TODOS los datos locales de todos los ciclos y grupos. Primero debes
            guardar un respaldo previo completo en otra ubicación elegida por ti. Cancelar ese
            guardado cancela la restauración.
          </p>
          <p>
            Si el ciclo o grupo guardado ya no está disponible, quedará sin seleccionar; se
            conservará el ciclo válido y no se elegirá otro grupo automáticamente.
          </p>
          <label className="backup-confirmation">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />{' '}
            Confirmo reemplazar todos los datos locales por este respaldo.
          </label>
          <div>
            <button
              data-cancel
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setConfirmed(false);
                setMessage('Restauración cancelada.');
                setError('');
              }}
            >
              Cancelar restauración
            </button>{' '}
            <button
              disabled={!confirmed || busy || contextBusy}
              onClick={() =>
                void operate(async () => {
                  const restored = await backup!.restore(preview.source, confirmed, (source) =>
                    saveBackup(source, true),
                  );
                  if (!restored) {
                    setPreview(null);
                    setConfirmed(false);
                    setMessage('Restauración cancelada. La base se conserva.');
                    return;
                  }
                  setCommitted(true);
                  setPreview(null);
                  setConfirmed(false);
                  onRestored();
                  await refresh();
                })
              }
            >
              Guardar respaldo previo y restaurar
            </button>
          </div>
        </div>
      )}
      {busy && <p role="status">Procesando respaldo… Espera a que termine.</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {committed && (
        <button disabled={busy} onClick={() => void operate(refresh)}>
          Reintentar lectura del contexto
        </button>
      )}
    </section>
  );
}
