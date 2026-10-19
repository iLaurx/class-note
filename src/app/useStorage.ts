import { createContext, useContext, useSyncExternalStore } from 'react';
import { storageService } from '../db/storage';

export const StorageContext = createContext(storageService);

export function useStorage() {
  const service = useContext(StorageContext);
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot);
  return {
    state,
    retry: service.initialize,
    repositories: state.status === 'ready' ? service.repositories : undefined,
  };
}
