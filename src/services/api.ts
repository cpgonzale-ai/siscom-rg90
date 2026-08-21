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
