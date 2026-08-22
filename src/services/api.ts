export interface LibroRow {
  doc: string;
  sistema: string;
  local: string;
  fecha: string;
  fecha_iso?: string;
  ruc: string;
  nombre: string;
  gravadas: string;
  iva: string;
  gravadas_5?: string;
  iva_5?: string;
  exentas: string;
  total: string;
  gravadas_num?: number;
  iva_num?: number;
  gravadas_5_num?: number;
  iva_5_num?: number;
  exentas_num?: number;
  total_num?: number;
  estado: string;
  // Derivado por el motor a partir de la sección del reporte de origen (ej. la marca
  // "NOTA DE CREDITO" que trae Aloha) — "Factura" o "Nota de Crédito".
  tipo_doc?: string;
}

// Fila de cierre/subtotal tal como la imprime el sistema de origen (ej. "Serie: 001
// Totales", "Resolución: 052 Totales") — se conserva para poder cotejarla contra lo que
// el motor calculó y para armar el resumen del libro en limpio.
export interface CorteRow {
  etiqueta: string;
  seccion: string;
  gravada: number;
  iva: number;
  total: number;
  archivo: string;
  local: string;
}

export interface IngestResult {
  success: boolean;
  lote_id: number;
  total_rows: number;
  gaps_count: number;
  rows: LibroRow[];
  gaps: CorrelatividadRow[];
  cortes: CorteRow[];
}

export interface CorrelatividadRow {
  local: string;
  sistema: string;
  tipo_doc?: string;
  ultimo: string;
  salto: string;
  cantidad: number;
  estado: string;
}

export interface RG90DiffRow {
  doc: string;
  sistema: string;
  local: string;
  libro: string;
  rg90: string;
  diferencia: string;
}

export interface UploadedFileMeta {
  id: number;
  sistemaKey: string;
  fileName: string;
  uploadedAt: string;
  rawFile?: File;
}

export interface Local {
  id: number;
  nombre: string;
  punto_expedicion: string;
  codigo: string | null;
  estado: 'activo' | 'inactivo';
  created_at: string;
  updated_at: string;
}

export interface Permiso {
  id: number;
  clave: string;
  nombre: string;
  tipo: 'pantalla' | 'boton';
  pantalla: string;
}

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  es_sistema: boolean;
  estado: 'activo' | 'inactivo';
  permisos: string[];
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  rol_id: number | null;
  activo: boolean;
  created_at: string;
}

export interface MeInfo extends Usuario {
  permisos: string[];
}

export interface EventoAuditoria {
  id: number;
  fecha: string;
  accion: string;
  descripcion: string;
  usuario: string;
}

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8090/api' : '/api');

let authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

function authHeaders(): HeadersInit {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  if (res.status === 401) throw new Error('Tu sesión expiró o no iniciaste sesión. Volvé a loguearte e intentá de nuevo.');
  if (res.status === 403) throw new Error('No tenés permiso para hacer esto.');
  let detail = '';
  try { detail = (await res.json())?.detail || ''; } catch { /* respuesta sin JSON */ }
  throw new Error(detail || `${fallback} (HTTP ${res.status}).`);
}

async function authedJson<T>(path: string, options: RequestInit = {}, fallback: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) return throwApiError(res, fallback);
  if (res.status === 204) return undefined as T;
  return await res.json();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loginApi(email: string, password: string): Promise<{ access_token: string; rol: string }> {
  const body = new URLSearchParams();
  body.append('username', email);
  body.append('password', password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw new Error('Usuario o contraseña incorrectos.');
  return await res.json();
}

export async function ingestFilesApi(files: File[], systemKey: string, localName: string = 'Local General'): Promise<IngestResult> {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('system_key', systemKey);
  formData.append('local_name', localName);

  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Tu sesión expiró o no iniciaste sesión. Volvé a loguearte e intentá de nuevo.');
    let detail = '';
    try { detail = (await res.json())?.detail || ''; } catch { /* respuesta sin JSON */ }
    throw new Error(detail || `Error al procesar los archivos en el servidor (HTTP ${res.status}).`);
  }
  return await res.json();
}

// La RG90 se descarga en reportes separados por tipo de comprobante (venta y nota de
// crédito, ver Minuta 3) y ambos se consolidan en el backend antes de comparar.
export async function reconcileApi(rg90Files: File[], posRows: LibroRow[], loteId?: number) {
  const formData = new FormData();
  rg90Files.forEach(f => formData.append('rg90_files', f));
  formData.append('pos_data_json', JSON.stringify(posRows));
  if (loteId !== undefined) formData.append('lote_id', String(loteId));

  const res = await fetch(`${API_BASE}/reconcile`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) throw new Error('Error al ejecutar la comparación RG90.');
  return await res.json();
}

// ── /api/auth/me ──────────────────────────────────────────────────────────
export function getMeApi(): Promise<MeInfo> {
  return authedJson<MeInfo>('/auth/me', {}, 'Error al obtener el usuario actual');
}

// ── Locales ────────────────────────────────────────────────────────────────
export function listLocalesApi(): Promise<Local[]> {
  return authedJson<Local[]>('/locales', {}, 'Error al listar locales');
}
export function createLocalApi(datos: Omit<Local, 'id' | 'created_at' | 'updated_at'>): Promise<Local> {
  return authedJson<Local>('/locales', { method: 'POST', body: JSON.stringify(datos) }, 'Error al crear el local');
}
export function updateLocalApi(id: number, datos: Partial<Omit<Local, 'id' | 'created_at' | 'updated_at'>>): Promise<Local> {
  return authedJson<Local>(`/locales/${id}`, { method: 'PUT', body: JSON.stringify(datos) }, 'Error al editar el local');
}
export function deleteLocalApi(id: number): Promise<void> {
  return authedJson<void>(`/locales/${id}`, { method: 'DELETE' }, 'Error al eliminar el local');
}

// ── Roles y permisos ─────────────────────────────────────────────────────
export function listRolesApi(): Promise<Rol[]> {
  return authedJson<Rol[]>('/roles', {}, 'Error al listar roles');
}
export function listPermisosApi(): Promise<Permiso[]> {
  return authedJson<Permiso[]>('/roles/permisos', {}, 'Error al listar permisos');
}
export function createRolApi(datos: { nombre: string; descripcion?: string; estado?: 'activo' | 'inactivo'; permisos: string[] }): Promise<Rol> {
  return authedJson<Rol>('/roles', { method: 'POST', body: JSON.stringify(datos) }, 'Error al crear el rol');
}
export function updateRolApi(id: number, datos: { nombre?: string; descripcion?: string; estado?: 'activo' | 'inactivo'; permisos?: string[] }): Promise<Rol> {
  return authedJson<Rol>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(datos) }, 'Error al editar el rol');
}
export function deleteRolApi(id: number): Promise<void> {
  return authedJson<void>(`/roles/${id}`, { method: 'DELETE' }, 'Error al eliminar el rol');
}

// ── Usuarios ──────────────────────────────────────────────────────────────
export function listUsuariosApi(): Promise<Usuario[]> {
  return authedJson<Usuario[]>('/auth/usuarios', {}, 'Error al listar usuarios');
}
export function createUsuarioApi(datos: { nombre: string; email: string; password: string; rol_id: number; activo?: boolean }): Promise<Usuario> {
  return authedJson<Usuario>('/auth/usuarios', { method: 'POST', body: JSON.stringify(datos) }, 'Error al crear el usuario');
}
export function updateUsuarioApi(id: number, datos: { nombre?: string; rol_id?: number; activo?: boolean; password?: string }): Promise<Usuario> {
  return authedJson<Usuario>(`/auth/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(datos) }, 'Error al editar el usuario');
}
export function deleteUsuarioApi(id: number): Promise<void> {
  return authedJson<void>(`/auth/usuarios/${id}`, { method: 'DELETE' }, 'Error al desactivar el usuario');
}

// ── Auditoría ─────────────────────────────────────────────────────────────
export function listAuditoriaApi(acciones: string[], entidadId?: number, limit = 100): Promise<EventoAuditoria[]> {
  const qs = new URLSearchParams({ acciones: acciones.join(','), limit: String(limit) });
  if (entidadId !== undefined) qs.set('entidad_id', String(entidadId));
  return authedJson<EventoAuditoria[]>(`/auditoria?${qs.toString()}`, {}, 'Error al obtener la auditoría');
}
