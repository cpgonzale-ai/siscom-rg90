// Persistencia de estado en el cliente para no perder el libro cargado ante un refresh
// accidental, un cuelgue del navegador o un cierre inesperado (ver Ventas/Compras en
// App.tsx y ComprasView.tsx). Usa IndexedDB en vez de localStorage: los libros reales de
// este sistema llegan a decenas o cientos de miles de filas, y localStorage tiene un
// límite típico de ~5-10MB por sitio (fallaría justo en los archivos más grandes) además
// de ser síncrono (bloquea el hilo principal al guardar un objeto grande). IndexedDB es
// asíncrono y no tiene ese techo práctico.
const DB_NAME = 'siscom_persist';
const STORE = 'kv';

// Claves compartidas entre App.tsx (Ventas) y ComprasView.tsx (Compras) — centralizadas
// acá para que handleLogout (App.tsx) pueda limpiar ambas sin duplicar el literal.
export const VENTAS_PERSIST_KEY = 'ventas_estado_v1';
export const COMPRAS_PERSIST_KEY = 'compras_estado_v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Todas las funciones tragan sus propios errores (modo privado sin IndexedDB, cuota
// agotada, etc.): esto es una red de seguridad ante un cuelgue, nunca debe ser la causa
// de uno — si falla, la app sigue funcionando exactamente igual, solo sin recuperación.
export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ver comentario de arriba
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ver comentario de arriba
  }
}
