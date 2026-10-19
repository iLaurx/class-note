import { ClassNoteDatabase } from './database.ts';
import { Repositories } from './repositories.ts';
import { storageOperation } from './errors.ts';

export type StorageState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export class StorageService {
  readonly repositories: Repositories;
  private readonly database: ClassNoteDatabase;
  private state: StorageState = { status: 'loading' };
  private pending: Promise<void> | undefined;
  private readonly listeners = new Set<() => void>();

  constructor(database = new ClassNoteDatabase()) {
    this.database = database;
    this.repositories = new Repositories(database);
  }

  getSnapshot = (): StorageState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(state: StorageState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  initialize = (): Promise<void> => {
    if (this.pending) return this.pending;
    if (this.database.isOpen() && this.state.status === 'ready') return Promise.resolve();
    this.publish({ status: 'loading' });
    this.pending = storageOperation(async () => {
      await this.database.open();
    })
      .then(() => {
        this.publish({ status: 'ready' });
      })
      .catch(() => {
        this.publish({
          status: 'error',
          message:
            'No se pudo abrir el almacenamiento local. Reintenta o cierra y vuelve a abrir ClassNote. No se han borrado tus datos.',
        });
      })
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  };
}

export const storageService = new StorageService();
