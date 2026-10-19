import { ValidationError } from '../domain/validation.ts';

export class StorageError extends Error {}

export async function storageOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (error instanceof ValidationError || error instanceof StorageError) throw error;
    if (error instanceof Error && error.name === 'ConstraintError') {
      throw new StorageError('Ya existe un registro con esos datos. Revisa si está duplicado.');
    }
    throw new StorageError(
      'No se pudo acceder al almacenamiento local. Reintenta; tus datos no se borrarán automáticamente.',
    );
  }
}
