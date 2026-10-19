import { createContext, useContext } from 'react';
import type { Repositories } from '../db/repositories';
export type Workspace = Awaited<ReturnType<Repositories['loadWorkspace']>>;
export interface WorkContextValue {
  data: Workspace | null;
  busy: boolean;
  error: string;
  run: (operation?: (repositories: Repositories) => Promise<unknown>) => Promise<boolean>;
}
export const WorkContext = createContext<WorkContextValue | null>(null);
export function useWorkContext() {
  const value = useContext(WorkContext);
  if (!value) throw new Error('Falta el contexto de trabajo.');
  return value;
}
