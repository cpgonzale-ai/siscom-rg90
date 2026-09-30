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
  // Sistema detectado automáticamente por archivo (el Paso 1 ya no lo pide de antemano) —
  // ver /api/ingest.
  archivos_detectados?: { archivo: string; sistema_key: string; sistema_label: string }[];
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

// Desglose por tasa (gravada 10%/5%, IVA 10%/5%, exenta, total) de un lado de la
// comparación — mismo shape que CompraDiffLado, ver reconcile_with_rg90() en engine.py.
export interface RG90DiffLado {
  gravada_10: string;
  iva_10: string;
  gravada_5: string;
  iva_5: string;
  exenta: string;
  total: string;
}

export interface RG90DiffRow {
  doc: string;
  tipo_doc: string;
  sistema: string;
  local: string;
  libro: RG90DiffLado;
  rg90: RG90DiffLado;
  diferencia: string;
  diferencias_detalle?: Record<string, number>;
}

// Comprobantes duplicados (mismo doc Y mismo tipo_doc, dos o más veces) detectados al
// adjuntar el Libro o la RG90 — misma validación de siempre (ver
// _insertar_lote_diagnosticando_duplicados en el backend, main.py), corta la comparación
// igual que antes; esto es solo la forma estructurada del mensaje de error, para mostrarlo
// en una grilla en vez de un párrafo con solo 5 ejemplos.
export interface ComprobantesDuplicadosDetalle {
  comprobante: string;
  tipo: string;
  cantidad: number | string;
  origen: 'Libro' | 'RG90';
}
export interface ComprobantesDuplicadosError {
  tipo: 'comprobantes_duplicados';
  // 'Ambos' cuando /api/reconcile encuentra duplicados en el Libro Y en la RG90 a la vez
  // (ver _armar_error_duplicados, backend) -- cada item de "detalle" sigue teniendo su
  // propio origen individual ('Libro' o 'RG90'), esto es solo el resumen a nivel del error.
  origen: 'Libro' | 'RG90' | 'Ambos';
  titulo: string;
  mensaje: string;
  resumen: { origen: string; cantidad: number }[];
  detalle: ComprobantesDuplicadosDetalle[];
  aclaracion?: string | null;
}

// Error tipado para poder distinguir "vinieron comprobantes duplicados" (con toda la data
// para armar la grilla) de cualquier otro error de /api/reconcile (formato de archivo
// inválido, sesión expirada, etc.), que sigue siendo un Error común con solo un mensaje.
export class ReconcileDuplicadosError extends Error {
  payload: ComprobantesDuplicadosError;
  constructor(payload: ComprobantesDuplicadosError) {
    super(payload.mensaje);
    this.name = 'ReconcileDuplicadosError';
    this.payload = payload;
  }
}

// Libro de Compras (Minuta 5) — a diferencia de LibroRow (ventas), acá "clave" es la que se
// usa para comparar contra la RG (documento + RUC del proveedor sin dígito verificador,
// concatenados) porque el documento solo no alcanza: distintos proveedores repiten
// numeración.
export interface CompraRow {
  doc: string;
  clave: string;
  sistema: string;
  local: string;
  codigo_sucursal: string;
  fecha: string;
  ruc_proveedor: string;
  dv_proveedor: string;
  proveedor: string;
  tipo_comprobante: string;
  tipo_doc: string;
  condicion: string;
  timbrado: string;
  control: string;
  gravadas: string;
  iva: string;
  gravadas_5: string;
  iva_5: string;
  exentas: string;
  total: string;
  gravadas_num?: number;
  iva_num?: number;
  gravadas_5_num?: number;
  iva_5_num?: number;
  exentas_num?: number;
  total_num?: number;
  estado: string;
}

export interface CompraIngestResult {
  success: boolean;
  lote_id: number;
  total_rows: number;
  rows: CompraRow[];
}

export interface CompraDiffLado {
  gravada_10: string;
  iva_10: string;
  gravada_5: string;
  iva_5: string;
  exenta: string;
  total: string;
}

export interface CompraDiffRow {
  doc: string;
  tipo_doc: string;
  proveedor: string;
  sistema: string;
  local: string;
  libro: CompraDiffLado;
  rg: CompraDiffLado;
  diferencia: string;
  diferencias_detalle?: Record<string, number>;
}

export interface CompraReconcileResult {
  success: boolean;
  lote_id: number;
  rg_total_rows: number;
  rg_rows: CompraRow[];
  // Saltos de numeración detectados DENTRO de la RG de compras misma (por proveedor —
  // ver detect_sequence_gaps en engine.py), no contra el libro propio: acá no hay control
  // de correlatividad del libro propio (no es responsabilidad del comprador que un
  // proveedor salte numeración).
  rg_gaps: any[];
  diffs: CompraDiffRow[];
  summary: { coinciden: number; no_en_rg: number; no_en_libro: number; diferencia_monto: number };
}

export interface UploadedFileMeta {
  id: number;
  sistemaKey: string;
  // Se completa recién después de analizar (ver archivos_detectados en IngestResult) — el
  // Paso 1 ya no pide elegir el sistema de antemano, lo detecta el backend por archivo.
  sistemaLabel?: string;
  fileName: string;
  uploadedAt: string;
  rawFile?: File;
}

export interface Local {
  id: number;
  nombre: string;
  establecimiento: string | null;
  punto_expedicion: string | null;
  codigo: string | null;
  abreviatura: string | null;
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
  nro_documento: string;
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

// fetch() no expone progreso de SUBIDA (solo de descarga, vía response.body) -- para poder
// mostrar una barra de avance real mientras se sube y analiza un archivo grande (Libro o
// RG90, ver ProgressModal/utils/progreso.ts) hace falta xhr.upload.onprogress, que solo
// XMLHttpRequest tiene. Se arma un objeto con la misma porción de Response que el resto del
// código ya usa (status/ok/json()) para no duplicar el manejo de errores existente en cada
// función -- ingestFilesApi/validarDuplicadosLibroApi/validarDuplicadosRg90Api solo usan
// esto cuando reciben un onUploadProgress; sin ese callback siguen usando fetch como siempre.
function xhrPostFormData(
  url: string,
  formData: FormData,
  onUploadProgress: (loaded: number, total: number) => void,
): Promise<{ status: number; ok: boolean; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    Object.entries(authHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v as string));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onUploadProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        json: async () => { try { return JSON.parse(xhr.responseText); } catch { return null; } },
      });
    };
    xhr.onerror = () => reject(new Error('Error de red al conectar con el servidor.'));
    xhr.send(formData);
  });
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

export async function loginApi(nroDocumento: string, password: string): Promise<{ access_token: string; rol: string }> {
  const body = new URLSearchParams();
  body.append('username', nroDocumento);
  body.append('password', password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw new Error('Usuario o contraseña incorrectos.');
  return await res.json();
}

export async function ingestFilesApi(
  files: File[],
  systemKey: string,
  localName: string = 'Local General',
  onUploadProgress?: (loaded: number, total: number) => void,
): Promise<IngestResult> {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('system_key', systemKey);
  formData.append('local_name', localName);

  const res = onUploadProgress
    ? await xhrPostFormData(`${API_BASE}/ingest`, formData, onUploadProgress)
    : await fetch(`${API_BASE}/ingest`, { method: 'POST', headers: authHeaders(), body: formData });

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
export async function reconcileApi(
  rg90Files: File[],
  posRows: LibroRow[],
  loteId?: number,
  onUploadProgress?: (loaded: number, total: number) => void,
) {
  const formData = new FormData();
  rg90Files.forEach(f => formData.append('rg90_files', f));
  // Se manda como archivo (Blob), no como campo de texto plano: un campo de texto llega al
  // backend ya reconstruido entero en memoria (FastAPI/Starlette lo bufferean como un solo
  // string), mientras que un archivo se puede leer del lado del servidor en streaming desde
  // el spool en disco — necesario para que /api/reconcile pueda parsear esto con ijson sin
  // volver a levantar las 200.000 filas enteras en RAM (ver auditoria/12, hallazgo de OOM:
  // un pedido de ese tamaño hacía que un worker pasara de 130MB a 1,83GB de RSS y muriera).
  formData.append('pos_data_json', new Blob([JSON.stringify(posRows)], { type: 'application/json' }), 'pos_data.json');
  if (loteId !== undefined) formData.append('lote_id', String(loteId));

  const res = onUploadProgress
    ? await xhrPostFormData(`${API_BASE}/reconcile`, formData, onUploadProgress)
    : await fetch(`${API_BASE}/reconcile`, { method: 'POST', headers: authHeaders(), body: formData });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Tu sesión expiró o no iniciaste sesión. Volvé a loguearte e intentá de nuevo.');
    let detail: unknown = '';
    try { detail = (await res.json())?.detail ?? ''; } catch { /* respuesta sin JSON */ }
    // El backend manda el detail como objeto (no string) específicamente para este caso
    // (ver el porqué en ComprobantesDuplicadosError, arriba) -- cualquier otro error sigue
    // llegando como string, sin cambios.
    if (detail && typeof detail === 'object' && (detail as { tipo?: string }).tipo === 'comprobantes_duplicados') {
      throw new ReconcileDuplicadosError(detail as ComprobantesDuplicadosError);
    }
    throw new Error((typeof detail === 'string' && detail) || `Error al ejecutar la comparación RG90 (HTTP ${res.status}).`);
  }
  return await res.json();
}

// Valida el libro propio en busca de comprobantes duplicados apenas se adjunta (Paso 1),
// sin esperar a que se adjunte la RG90 ni a que se ejecute la comparación -- reutiliza EN
// EL BACKEND la misma validación de siempre (_insertar_lote_diagnosticando_duplicados vía
// _cargar_libro_en_sqlite), esto solo la adelanta en el tiempo. Mismo criterio de error que
// reconcileApi: un duplicado tira ReconcileDuplicadosError (con la grilla completa), otros
// problemas de formato quedan como Error común y no se muestran acá (la comparación en el
// Paso 3 los va a volver a mostrar igual que siempre).
export async function validarDuplicadosLibroApi(
  posRows: LibroRow[],
  onUploadProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const formData = new FormData();
  formData.append('pos_data_json', new Blob([JSON.stringify(posRows)], { type: 'application/json' }), 'pos_data.json');

  const res = onUploadProgress
    ? await xhrPostFormData(`${API_BASE}/validar-duplicados-libro`, formData, onUploadProgress)
    : await fetch(`${API_BASE}/validar-duplicados-libro`, { method: 'POST', headers: authHeaders(), body: formData });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Tu sesión expiró o no iniciaste sesión. Volvé a loguearte e intentá de nuevo.');
    let detail: unknown = '';
    try { detail = (await res.json())?.detail ?? ''; } catch { /* respuesta sin JSON */ }
    if (detail && typeof detail === 'object' && (detail as { tipo?: string }).tipo === 'comprobantes_duplicados') {
      throw new ReconcileDuplicadosError(detail as ComprobantesDuplicadosError);
    }
    throw new Error((typeof detail === 'string' && detail) || `Error al validar el libro (HTTP ${res.status}).`);
  }
}

// Valida la(s) RG90 en busca de comprobantes duplicados apenas se adjunta (Paso 3), sin
// esperar a la comparación contra el libro -- ver validarDuplicadosLibroApi, mismo criterio.
export async function validarDuplicadosRg90Api(
  rg90Files: File[],
  onUploadProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const formData = new FormData();
  rg90Files.forEach(f => formData.append('rg90_files', f));

  const res = onUploadProgress
    ? await xhrPostFormData(`${API_BASE}/validar-duplicados-rg90`, formData, onUploadProgress)
    : await fetch(`${API_BASE}/validar-duplicados-rg90`, { method: 'POST', headers: authHeaders(), body: formData });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Tu sesión expiró o no iniciaste sesión. Volvé a loguearte e intentá de nuevo.');
    let detail: unknown = '';
    try { detail = (await res.json())?.detail ?? ''; } catch { /* respuesta sin JSON */ }
    if (detail && typeof detail === 'object' && (detail as { tipo?: string }).tipo === 'comprobantes_duplicados') {
      throw new ReconcileDuplicadosError(detail as ComprobantesDuplicadosError);
    }
    throw new Error((typeof detail === 'string' && detail) || `Error al validar la RG90 (HTTP ${res.status}).`);
  }
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
export function createUsuarioApi(datos: { nombre: string; nro_documento: string; email: string; password: string; rol_id: number; activo?: boolean }): Promise<Usuario> {
  return authedJson<Usuario>('/auth/usuarios', { method: 'POST', body: JSON.stringify(datos) }, 'Error al crear el usuario');
}
export function updateUsuarioApi(id: number, datos: { nombre?: string; nro_documento?: string; rol_id?: number; activo?: boolean; password?: string }): Promise<Usuario> {
  return authedJson<Usuario>(`/auth/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(datos) }, 'Error al editar el usuario');
}
export function deleteUsuarioApi(id: number): Promise<void> {
  return authedJson<void>(`/auth/usuarios/${id}`, { method: 'DELETE' }, 'Error al desactivar el usuario');
}

// ── Libro de Compras (Minuta 5) ─────────────────────────────────────────────
export async function ingestComprasApi(
  files: File[],
  localName: string = 'Local General',
  onUploadProgress?: (loaded: number, total: number) => void,
): Promise<CompraIngestResult> {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('local_name', localName);

  const res = onUploadProgress
    ? await xhrPostFormData(`${API_BASE}/compras/ingest`, formData, onUploadProgress)
    : await fetch(`${API_BASE}/compras/ingest`, { method: 'POST', headers: authHeaders(), body: formData });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Tu sesión expiró o no iniciaste sesión. Volvé a loguearte e intentá de nuevo.');
    let detail = '';
    try { detail = (await res.json())?.detail || ''; } catch { /* respuesta sin JSON */ }
    throw new Error(detail || `Error al procesar los archivos en el servidor (HTTP ${res.status}).`);
  }
  return await res.json();
}

export async function reconcileComprasApi(
  rgFiles: File[],
  comprasRows: CompraRow[],
  loteId?: number,
  onUploadProgress?: (loaded: number, total: number) => void,
): Promise<CompraReconcileResult> {
  const formData = new FormData();
  rgFiles.forEach(f => formData.append('rg_files', f));
  formData.append('pos_data_json', JSON.stringify(comprasRows));
  if (loteId !== undefined) formData.append('lote_id', String(loteId));

  const res = onUploadProgress
    ? await xhrPostFormData(`${API_BASE}/compras/reconcile`, formData, onUploadProgress)
    : await fetch(`${API_BASE}/compras/reconcile`, { method: 'POST', headers: authHeaders(), body: formData });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Tu sesión expiró o no iniciaste sesión. Volvé a loguearte e intentá de nuevo.');
    let detail = '';
    try { detail = (await res.json())?.detail || ''; } catch { /* respuesta sin JSON */ }
    throw new Error(detail || `Error al comparar contra la RG (HTTP ${res.status}).`);
  }
  return await res.json();
}

// ── Export a Excel (server-side) ────────────────────────────────────────────
// Ver auditoria/13-export-excel-wysiwyg.md: armar el .xlsx en el navegador (librería xlsx)
// revienta con "JavaScript heap out of memory" arriba de ~100-150 mil filas, sin importar si
// corre en el hilo principal o en un Web Worker -- para grillas que pueden llegar a 200.000
// filas (Detalle de Discrepancias, RG90 (SET) — Ventas) el archivo se arma en el backend
// (openpyxl en modo streaming) y acá solo se dispara la descarga del blob que devuelve.

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// El JSON de estos pedidos (Detalle de Discrepancias con decenas de miles de filas, cada
// una con el libro Y la RG90 anidados) llega a pesar varias decenas de MB -- medido: 41MB
// para 97.851 filas. Ese JSON es MUY repetitivo (mismos nombres de campo miles de veces,
// números con el mismo formato) y comprime ~10x con gzip (41MB -> 3,8MB, medido con un
// archivo real). Esa subida corre por la conexión del propio usuario, no por la del
// servidor -- es, en la práctica, el cuello de botella más grande de esta descarga con
// archivos grandes, mucho más que el tiempo que el servidor tarda en armar el Excel en sí.
// CompressionStream (soportado en todos los navegadores modernos -- Chrome/Edge 80+,
// Firefox 113+, Safari 16.4+) comprime el body antes de subirlo; el backend lo descomprime
// en un middleware (GzipRequestDecompressionMiddleware, main.py) antes de que llegue a
// cualquier endpoint, así que ningún endpoint necesita saber que esto existe.
async function comprimirGzip(texto: string): Promise<Blob | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(stream).blob();
  } catch {
    // Nunca debe ser la causa de que la descarga deje de funcionar -- si falla comprimir,
    // se manda sin comprimir (más lento, pero funciona igual).
    return null;
  }
}

async function postParaDescarga(path: string, body: unknown, filename: string, fallback: string): Promise<void> {
  const json = JSON.stringify(body);
  const comprimido = await comprimirGzip(json);
  const headers: Record<string, string> = { ...(authHeaders() as Record<string, string>), 'Content-Type': 'application/json' };
  if (comprimido) headers['Content-Encoding'] = 'gzip';

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: comprimido ?? json,
  });
  if (!res.ok) return throwApiError(res, fallback);
  const blob = await res.blob();
  triggerBlobDownload(blob, filename);
}

export function exportarTablaExcelApi(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]): Promise<void> {
  return postParaDescarga('/export/tabla-excel', { filename, sheet_name: sheetName, headers, rows }, filename, 'Error al generar el Excel');
}

export function exportarDiffVentasExcelApi(rows: RG90DiffRow[], visibleColumns: string[]): Promise<void> {
  return postParaDescarga(
    '/export/diff-ventas-excel',
    { rows, visible_columns: visibleColumns },
    'Resultado_Comparacion_Ventas_RG90.xlsx',
    'Error al generar el Excel',
  );
}

// ── Auditoría ─────────────────────────────────────────────────────────────
export function listAuditoriaApi(acciones: string[], entidadId?: number, limit = 100): Promise<EventoAuditoria[]> {
  const qs = new URLSearchParams({ acciones: acciones.join(','), limit: String(limit) });
  if (entidadId !== undefined) qs.set('entidad_id', String(entidadId));
  return authedJson<EventoAuditoria[]>(`/auditoria?${qs.toString()}`, {}, 'Error al obtener la auditoría');
}
