import { invoke, isTauri } from '@tauri-apps/api/core';

async function fileCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri())
    throw new Error('Abre ClassNote de escritorio para elegir el archivo de respaldo.');
  try {
    return await invoke<T>(command, args);
  } catch {
    throw new Error(
      'No se pudo leer o guardar el respaldo. Revisa el archivo, los permisos y el espacio disponible.',
    );
  }
}
export const openBackup = () => fileCommand<string | null>('open_backup');
export const saveBackup = (source: string, previous = false) =>
  fileCommand<boolean>('save_backup', { source, previous });
