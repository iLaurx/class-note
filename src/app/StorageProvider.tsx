import { useEffect, type ReactNode } from 'react';
import { storageService, type StorageService } from '../db/storage';
import { StorageContext } from './useStorage';

export function StorageProvider({
  children,
  service = storageService,
}: {
  children: ReactNode;
  service?: StorageService;
}) {
  useEffect(() => {
    void service.initialize();
  }, [service]);
  return <StorageContext.Provider value={service}>{children}</StorageContext.Provider>;
}
