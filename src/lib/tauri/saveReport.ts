import { invoke, isTauri } from '@tauri-apps/api/core';

export async function saveReport(bytes: Uint8Array): Promise<boolean> {
  if (!isTauri())
    throw new Error('Abre ClassNote de escritorio para elegir dónde guardar el reporte.');
  try {
    return await invoke<boolean>('save_group_report', { bytes: Array.from(bytes) });
  } catch (cause) {
    throw new Error(
      typeof cause === 'string' ? cause : 'No se pudo guardar el reporte. Reintenta.',
      { cause },
    );
  }
}
