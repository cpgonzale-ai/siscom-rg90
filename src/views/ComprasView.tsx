import React, { useMemo, useState } from 'react';
import {
  UploadCloud, Trash2, FileSpreadsheet, X, GitCompare, Download,
  ArrowLeft, ArrowRight,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { WizardSteps } from '../components/WizardSteps';
import { ExcelFilterHeader } from '../components/ExcelFilterHeader';
import { ColumnPicker } from '../components/ColumnPicker';
import { secondaryBtnStyle, primaryBtnStyle, dangerBtnStyle, navRowStyle, disabledBtnStyle } from '../components/Modal';
import type { Local, CompraRow, CompraDiffRow, CompraDiffLado } from '../services/api';
import { ingestComprasApi, reconcileComprasApi } from '../services/api';
import { downloadExcel } from '../utils/exportExcel';
import { formatGs } from '../utils/format';

interface ComprasViewProps {
  locales: Local[];
  permisos: Set<string>;
}

interface ArchivoAdjunto {
  id: number;
  fileName: string;
  rawFile: File;
}

const PAGE_SIZE = 50;

// Columnas con filtro tipo Excel en la grilla del libro cargado (paso 1) — se dejan afuera
// los importes (Gravada/IVA/Exenta/Total): son valores casi todos distintos entre sí, un
// listado de checkboxes ahí no ayuda, para eso ya está el buscador general.
// Los importes usan el mismo texto ya formateado por el backend (r.gravadas, no
// r.gravadas_num) — el filtro ofrece/compara exactamente lo que se ve en la grilla, sin
// reformatear ("18.891.429,00" tal cual, nunca invertir coma y punto).
const LIBRO_COLUMNAS: { key: string; label: string; getValue: (r: CompraRow) => string }[] = [
  { key: 'doc', label: 'Documento', getValue: r => r.doc },
  { key: 'local', label: 'Local', getValue: r => r.local || '' },
  { key: 'fecha', label: 'Fecha', getValue: r => r.fecha },
  { key: 'proveedor', label: 'RUC / Proveedor', getValue: r => `${r.ruc_proveedor}-${r.dv_proveedor} — ${r.proveedor}` },
  { key: 'tipo_doc', label: 'Tipo', getValue: r => r.tipo_doc },
  { key: 'condicion', label: 'Forma de pago', getValue: r => r.condicion || '' },
  { key: 'timbrado', label: 'Timbrado', getValue: r => r.timbrado || '' },
  { key: 'gravadas', label: 'Gravada 10%', getValue: r => r.gravadas },
  { key: 'iva', label: 'IVA 10%', getValue: r => r.iva },
  { key: 'gravadas_5', label: 'Gravada 5%', getValue: r => r.gravadas_5 },
  { key: 'iva_5', label: 'IVA 5%', getValue: r => r.iva_5 },
  { key: 'exentas', label: 'Exenta', getValue: r => r.exentas },
  { key: 'total', label: 'Total', getValue: r => r.total },
  { key: 'estado', label: 'Estado', getValue: r => r.estado },
];

// Misma idea para la grilla de la RG (paso 2) — sin Estado, esa grilla no tiene esa columna.
const RG_COLUMNAS: { key: string; label: string; getValue: (r: CompraRow) => string }[] = [
  { key: 'doc', label: 'Documento', getValue: r => r.doc },
  { key: 'local', label: 'Local', getValue: r => r.local || '' },
  { key: 'fecha', label: 'Fecha', getValue: r => r.fecha },
  { key: 'proveedor', label: 'RUC / Proveedor', getValue: r => `${r.ruc_proveedor}${r.dv_proveedor ? `-${r.dv_proveedor}` : ''} — ${r.proveedor}` },
  { key: 'tipo_doc', label: 'Tipo', getValue: r => r.tipo_doc },
  { key: 'condicion', label: 'Forma de pago', getValue: r => r.condicion || '' },
  { key: 'timbrado', label: 'Timbrado', getValue: r => r.timbrado || '' },
  { key: 'gravadas', label: 'Gravada 10%', getValue: r => r.gravadas },
  { key: 'iva', label: 'IVA 10%', getValue: r => r.iva },
  { key: 'gravadas_5', label: 'Gravada 5%', getValue: r => r.gravadas_5 },
  { key: 'iva_5', label: 'IVA 5%', getValue: r => r.iva_5 },
  { key: 'exentas', label: 'Exenta', getValue: r => r.exentas },
  { key: 'total', label: 'Total', getValue: r => r.total },
];

// Suma de importes formateados como los devuelve el backend ("18.891.429,00") — se
// necesita volver a número para poder sumar entre filas antes de re-formatear el total.
const parseGs = (s: string): number => {
  const n = parseFloat(String(s ?? '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

// Mismo criterio de "en cero si no es la causa de la diferencia" que usa cada celda al
// renderizarse — se repite acá para poder filtrar/sumar los importes REALMENTE visibles en
// la grilla, no los crudos que trae el backend.
const valorCeldaDiff = (d: CompraDiffRow, lado: 'libro' | 'rg', campo: keyof CompraDiffLado): string => {
  const valor = d[lado][campo];
  if (d.diferencia !== 'Diferencia de monto' || valor === '—') return valor;
  return d.diferencias_detalle && campo in d.diferencias_detalle ? valor : '0,00';
};

// Diferencia (Libro − RG) para un campo — con signo, mismo formato que el resto de los
// importes. Los lados "—" (comprobante que no está de ese lado) cuentan como 0.
const diferenciaCampo = (d: CompraDiffRow, campo: keyof CompraDiffLado): string =>
  formatGs(parseGs(valorCeldaDiff(d, 'libro', campo)) - parseGs(valorCeldaDiff(d, 'rg', campo)));

// Columnas de la grilla de resultado (paso 3), texto e importes — estos últimos con el
// mismo valor que se ve en cada celda (post v()/valorCeldaDiff), no el crudo del backend.
const DIFF_COLUMNAS: { key: string; label: string; getValue: (d: CompraDiffRow) => string }[] = [
  { key: 'doc', label: 'Documento', getValue: d => d.doc },
  { key: 'proveedor', label: 'Proveedor', getValue: d => d.proveedor },
  { key: 'local', label: 'Local', getValue: d => d.local },
  { key: 'libro_gravada_10', label: 'Gravada 10%', getValue: d => valorCeldaDiff(d, 'libro', 'gravada_10') },
  { key: 'libro_gravada_5', label: 'Gravada 5%', getValue: d => valorCeldaDiff(d, 'libro', 'gravada_5') },
  { key: 'libro_iva_10', label: 'IVA 10%', getValue: d => valorCeldaDiff(d, 'libro', 'iva_10') },
  { key: 'libro_iva_5', label: 'IVA 5%', getValue: d => valorCeldaDiff(d, 'libro', 'iva_5') },
  { key: 'libro_exenta', label: 'Exenta', getValue: d => valorCeldaDiff(d, 'libro', 'exenta') },
  { key: 'libro_total', label: 'Total', getValue: d => valorCeldaDiff(d, 'libro', 'total') },
  { key: 'rg_gravada_10', label: 'Gravada 10%', getValue: d => valorCeldaDiff(d, 'rg', 'gravada_10') },
  { key: 'rg_gravada_5', label: 'Gravada 5%', getValue: d => valorCeldaDiff(d, 'rg', 'gravada_5') },
  { key: 'rg_iva_10', label: 'IVA 10%', getValue: d => valorCeldaDiff(d, 'rg', 'iva_10') },
  { key: 'rg_iva_5', label: 'IVA 5%', getValue: d => valorCeldaDiff(d, 'rg', 'iva_5') },
  { key: 'rg_exenta', label: 'Exenta', getValue: d => valorCeldaDiff(d, 'rg', 'exenta') },
  { key: 'rg_total', label: 'Total', getValue: d => valorCeldaDiff(d, 'rg', 'total') },
  { key: 'dif_gravada_10', label: 'Gravada 10%', getValue: d => diferenciaCampo(d, 'gravada_10') },
  { key: 'dif_gravada_5', label: 'Gravada 5%', getValue: d => diferenciaCampo(d, 'gravada_5') },
  { key: 'dif_iva_10', label: 'IVA 10%', getValue: d => diferenciaCampo(d, 'iva_10') },
  { key: 'dif_iva_5', label: 'IVA 5%', getValue: d => diferenciaCampo(d, 'iva_5') },
  { key: 'dif_exenta', label: 'Exenta', getValue: d => diferenciaCampo(d, 'exenta') },
  { key: 'dif_total', label: 'Total', getValue: d => diferenciaCampo(d, 'total') },
  { key: 'diferencia', label: 'Motivo de la diferencia', getValue: d => d.diferencia },
];

// Todas las columnas de esta grilla, para el selector de "qué columnas visualizar" — mismo
// key que DIFF_COLUMNAS, con label sin repetir "Gravada 10%" tres veces sin contexto.
const DIFF_COLUMNAS_PICKER: { key: string; label: string }[] = [
  { key: 'doc', label: 'Documento' },
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'local', label: 'Local' },
  { key: 'libro_gravada_10', label: 'Libro — Gravada 10%' },
  { key: 'libro_gravada_5', label: 'Libro — Gravada 5%' },
  { key: 'libro_iva_10', label: 'Libro — IVA 10%' },
  { key: 'libro_iva_5', label: 'Libro — IVA 5%' },
  { key: 'libro_exenta', label: 'Libro — Exenta' },
  { key: 'libro_total', label: 'Libro — Total' },
  { key: 'rg_gravada_10', label: 'RG — Gravada 10%' },
  { key: 'rg_gravada_5', label: 'RG — Gravada 5%' },
  { key: 'rg_iva_10', label: 'RG — IVA 10%' },
  { key: 'rg_iva_5', label: 'RG — IVA 5%' },
  { key: 'rg_exenta', label: 'RG — Exenta' },
  { key: 'rg_total', label: 'RG — Total' },
  { key: 'dif_gravada_10', label: 'Diferencia — Gravada 10%' },
  { key: 'dif_gravada_5', label: 'Diferencia — Gravada 5%' },
  { key: 'dif_iva_10', label: 'Diferencia — IVA 10%' },
  { key: 'dif_iva_5', label: 'Diferencia — IVA 5%' },
  { key: 'dif_exenta', label: 'Diferencia — Exenta' },
  { key: 'dif_total', label: 'Diferencia — Total' },
  { key: 'diferencia', label: 'Motivo de la diferencia' },
];

// Las 4 categorías del resumen del Paso 3 — la key coincide con el "diferencia" que devuelve
// el backend ("Coincide", "No llegó a la interfaz", etc.), el label es el texto entendible
// que se muestra en la tarjeta y en el chip de filtro activo (antes cada uno mostraba un
// texto distinto para la misma categoría).
const RESUMEN_CATEGORIAS: { key: string; label: string; color: string }[] = [
  { key: 'Coincide', label: 'Registros que coinciden', color: '#128752' },
  { key: 'No llegó a la interfaz', label: 'Registros que no se encuentran en la RG', color: '#b3402f' },
  { key: 'No en libro propio', label: 'Registros que no se encuentran en libro de compras', color: '#b3402f' },
  { key: 'Diferencia de monto', label: 'Registros con diferencia de monto', color: '#b0740f' },
];

export const ComprasView: React.FC<ComprasViewProps> = ({ locales, permisos }) => {
  const puede = (clave: string) => permisos.has(clave);

  // ── Paso 1: carga del export del sistema ────────────────────────────────
  const [archivos, setArchivos] = useState<ArchivoAdjunto[]>([]);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [confirmEliminarTodos, setConfirmEliminarTodos] = useState(false);

  // ── Paso 1: libro procesado ──────────────────────────────────────────────
  const [rows, setRows] = useState<CompraRow[]>([]);
  const [loteId, setLoteId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [colFiltros, setColFiltros] = useState<Record<string, Set<string> | null>>({});

  // ── Paso 2: adjuntar RG y su propia grilla ──────────────────────────────
  const [rgFiles, setRgFiles] = useState<File[]>([]);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [rgRows, setRgRows] = useState<CompraRow[]>([]);
  const [rgGridSearch, setRgGridSearch] = useState('');
  const [rgGridPage, setRgGridPage] = useState(1);
  const [rgColFiltros, setRgColFiltros] = useState<Record<string, Set<string> | null>>({});
  // Saltos de numeración DENTRO de la RG de compras misma (agrupados por proveedor) — no
  // hay control de correlatividad del libro propio acá (ver docstring de ComprasEngine).

  // ── Paso 3: resultado de la comparación ─────────────────────────────────
  const [diffs, setDiffs] = useState<CompraDiffRow[]>([]);
  const [summary, setSummary] = useState<{ coinciden: number; no_en_rg: number; no_en_libro: number; diferencia_monto: number } | null>(null);
  const [diffSearch, setDiffSearch] = useState('');
  const [diffCategoryFilter, setDiffCategoryFilter] = useState<string>('');
  const [diffColFiltros, setDiffColFiltros] = useState<Record<string, Set<string> | null>>({});
  // Por defecto se ocultan la Gravada 10%/5% de ambos lados (Libro y RG) y sus columnas
  // "Diferencia" — el resto de los importes "Diferencia" (IVA 10%/5%, Exenta, Total) se
  // muestran de entrada. Todas quedan disponibles desde el selector de columnas.
  const [diffColOcultas, setDiffColOcultas] = useState<Set<string>>(new Set([
    'libro_gravada_10', 'libro_gravada_5', 'rg_gravada_10', 'rg_gravada_5',
    'dif_gravada_10', 'dif_gravada_5',
  ]));

  // Cuál de los 3 pasos se muestra en pantalla (a diferencia de ventas, que separa Carga y
  // RG90 en pantallas distintas del sidebar, acá es una sola pantalla — así que se
  // muestra un paso a la vez, como un wizard real: paso 2 solo el adjuntar RG90, paso 3
  // solo el resultado, sin que se acumule todo hacia abajo).
  const [pasoMostrado, setPasoMostrado] = useState<1 | 2 | 3>(1);

  // pasoActual = el progreso real alcanzado (para los "✓" de completado en la barra),
  // independiente de qué paso se esté mostrando en pantalla en este momento.
  const pasoActual = rows.length === 0 ? 1 : !summary ? 2 : 3;
  const wizardSteps = [
    { n: 1 as const, label: 'Cargar el libro de compras' },
    { n: 2 as const, label: 'Adjuntar RG90' },
    { n: 3 as const, label: 'Ver resultado' },
  ].map(st => {
    const active = st.n === pasoMostrado;
    const done = st.n < pasoActual;
    const reachable = st.n <= pasoActual;
    return {
      n: st.n,
      label: st.label,
      circleStyle: (done ? 'background:#128752;color:#fff' : active ? 'background:#f0a63d;color:#1a1a1a' : 'background:#e5e2da;color:#9aa1ab') + (reachable && !active ? ';cursor:pointer' : ';cursor:default'),
      labelStyle: (active ? 'color:#22262b;font-weight:700' : done ? 'color:#128752;font-weight:600' : 'color:#9aa1ab') + (reachable && !active ? ';cursor:pointer' : ''),
      mark: done ? '✓' : String(st.n),
      goTo: !reachable || active ? undefined : () => setPasoMostrado(st.n),
    };
  });

  // El código de sucursal (dónde se recibió la factura) no tiene relación con el punto de
  // expedición del proveedor — reutiliza la misma tabla de locales, pero por su campo
  // `codigo` (ver Minuta 5: "a diferencia de ventas ... en compras se empleará un código de
  // sucursal").
  const resolveLocal = (codigo: string): string => {
    const match = locales.find(l => l.estado === 'activo' && l.codigo && l.codigo === codigo);
    return match ? match.nombre : '';
  };

  const handleFileInput = (files: FileList) => {
    const nuevos: ArchivoAdjunto[] = Array.from(files).map(f => ({
      id: Date.now() + Math.random(),
      fileName: f.name,
      rawFile: f,
    }));
    setArchivos(prev => [...prev, ...nuevos]);
  };

  const quitarArchivo = (id: number) => setArchivos(prev => prev.filter(a => a.id !== id));

  const doEliminarTodos = () => {
    setArchivos([]);
    setConfirmEliminarTodos(false);
  };

  const doConvertir = async () => {
    if (archivos.length === 0) {
      setConvertError('Adjuntá al menos un archivo del libro de compras.');
      return;
    }
    setConverting(true);
    setConvertError(null);
    try {
      const res = await ingestComprasApi(archivos.map(a => a.rawFile));
      const rowsConLocal = (res.rows || []).map(r => ({ ...r, local: resolveLocal(r.codigo_sucursal) }));
      setRows(rowsConLocal);
      setLoteId(res.lote_id);
      setPage(1);
      if (!res.rows || res.rows.length === 0) {
        setConvertError('El servidor procesó el/los archivo(s) pero no encontró ningún comprobante válido. Revisá que sea el reporte de compras del sistema, sin editar a mano.');
      }
      // Se queda en el paso 1 mostrando la grilla — el usuario avanza al paso 2 con el
      // botón "Siguiente" cuando ya revisó el libro, no de forma automática.
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : 'Error al procesar los archivos en el servidor.');
    } finally {
      setConverting(false);
    }
  };

  const borrarLibro = () => {
    setRows([]);
    setLoteId(undefined);
    setArchivos([]);
    setColFiltros({});
    setRgFiles([]);
    setRgRows([]);
    setRgColFiltros({});
    setDiffs([]);
    setSummary(null);
    setDiffCategoryFilter('');
    setDiffColFiltros({});
    setPasoMostrado(1);
  };

  const handleRgFileInput = (files: FileList) => {
    // Ojo: convertir el FileList a array acá afuera, ANTES de llamar a setRgFiles, no adentro
    // del updater — el input resetea su value (e.target.value = '') apenas termina este
    // handler para poder re-seleccionar el mismo archivo, y ese reset vacía también el
    // FileList en vivo. Si Array.from(files) se evalúa recién cuando React llega a ejecutar
    // el updater (no necesariamente antes de ese reset), termina leyendo un FileList ya
    // vacío y la selección se pierde en silencio.
    const nuevos = Array.from(files);
    setRgFiles(prev => [...prev, ...nuevos]);
    setCompareError(null);
  };

  const quitarRgArchivo = (index: number) => {
    setRgFiles(prev => prev.filter((_, i) => i !== index));
  };

  const quitarRg = () => {
    setRgFiles([]);
    setRgRows([]);
    setRgColFiltros({});
    setDiffs([]);
    setSummary(null);
    setDiffCategoryFilter('');
    setDiffColFiltros({});
    setPasoMostrado(2);
  };

  const doComparar = async () => {
    if (rgFiles.length === 0) {
      setCompareError('Adjuntá el archivo de la RG (compras) descargado del SET.');
      return;
    }
    setComparing(true);
    setCompareError(null);
    try {
      const res = await reconcileComprasApi(rgFiles, rows, loteId);
      setRgRows(res.rg_rows || []);
      setRgGridPage(1);
      setDiffs(res.diffs || []);
      setSummary(res.summary);
      setDiffCategoryFilter('');
      setDiffColFiltros({});
      // Se queda en el paso 2, listando los datos de la RG — el usuario avanza al paso 3
      // con "Siguiente" cuando quiera ver el resultado de la comparación, igual que en el
      // paso 1 (analiza y lista ahí mismo, sin avanzar solo).
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : 'Error al comparar contra la RG.');
    } finally {
      setComparing(false);
    }
  };

  const descargarExcel = () => {
    if (rows.length === 0) return;
    const headers = ['Documento', 'Local', 'Fecha', 'RUC Proveedor', 'Proveedor', 'Tipo', 'Condición', 'Timbrado', 'Gravada 10%', 'IVA 10%', 'Gravada 5%', 'IVA 5%', 'Exenta', 'Total', 'Estado'];
    // Importes con el mismo texto ya formateado de la grilla (r.gravadas, no un number) —
    // el Excel descargado coincide con la pantalla tal cual, sin riesgo de que se invierta
    // coma y punto al abrirlo.
    const dataRows = rows.map(r => [
      r.doc, r.local, r.fecha, `${r.ruc_proveedor}-${r.dv_proveedor}`, r.proveedor, r.tipo_doc, r.condicion, r.timbrado,
      r.gravadas, r.iva, r.gravadas_5, r.iva_5, r.exentas, r.total, r.estado,
    ]);
    downloadExcel('Libro_de_Compras.xlsx', 'Libro de Compras', headers, dataRows);
  };

  const descargarRgExcel = () => {
    if (rgRows.length === 0) return;
    const headers = ['Documento', 'Local', 'Fecha', 'RUC Proveedor', 'Proveedor', 'Tipo', 'Condición', 'Timbrado', 'Gravada 10%', 'IVA 10%', 'Gravada 5%', 'IVA 5%', 'Exenta', 'Total'];
    const dataRows = rgRows.map(r => [
      r.doc, r.local, r.fecha, r.dv_proveedor ? `${r.ruc_proveedor}-${r.dv_proveedor}` : r.ruc_proveedor, r.proveedor, r.tipo_doc, r.condicion, r.timbrado,
      r.gravadas, r.iva, r.gravadas_5, r.iva_5, r.exentas, r.total,
    ]);
    downloadExcel('RG_Compras.xlsx', 'RG (SET) — Compras', headers, dataRows);
  };

  const filteredRows = useMemo(() => {
    let lista = rows;
    for (const col of LIBRO_COLUMNAS) {
      const activo = colFiltros[col.key];
      if (activo) lista = lista.filter(r => activo.has(col.getValue(r)));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      lista = lista.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }
    return lista;
  }, [rows, search, colFiltros]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hayColFiltrosActivos = Object.values(colFiltros).some(v => v !== null && v !== undefined);
  // Totalizador sobre TODO lo filtrado (no solo la página visible) — para que el total
  // acompañe al filtro/búsqueda, no solo a la paginación.
  const rowsTotales = useMemo(() => ({
    gravadas: filteredRows.reduce((s, r) => s + (r.gravadas_num || 0), 0),
    iva: filteredRows.reduce((s, r) => s + (r.iva_num || 0), 0),
    gravadas_5: filteredRows.reduce((s, r) => s + (r.gravadas_5_num || 0), 0),
    iva_5: filteredRows.reduce((s, r) => s + (r.iva_5_num || 0), 0),
    exentas: filteredRows.reduce((s, r) => s + (r.exentas_num || 0), 0),
    total: filteredRows.reduce((s, r) => s + (r.total_num || 0), 0),
  }), [filteredRows]);

  const filteredRgRows = useMemo(() => {
    let lista = rgRows;
    for (const col of RG_COLUMNAS) {
      const activo = rgColFiltros[col.key];
      if (activo) lista = lista.filter(r => activo.has(col.getValue(r)));
    }
    if (rgGridSearch.trim()) {
      const q = rgGridSearch.trim().toLowerCase();
      lista = lista.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }
    return lista;
  }, [rgRows, rgGridSearch, rgColFiltros]);
  const totalRgPages = Math.max(1, Math.ceil(filteredRgRows.length / PAGE_SIZE));
  const currentRgPage = Math.min(Math.max(1, rgGridPage), totalRgPages);
  const pagedRgRows = filteredRgRows.slice((currentRgPage - 1) * PAGE_SIZE, currentRgPage * PAGE_SIZE);
  const hayRgColFiltrosActivos = Object.values(rgColFiltros).some(v => v !== null && v !== undefined);
  const rgRowsTotales = useMemo(() => ({
    gravadas: filteredRgRows.reduce((s, r) => s + (r.gravadas_num || 0), 0),
    iva: filteredRgRows.reduce((s, r) => s + (r.iva_num || 0), 0),
    gravadas_5: filteredRgRows.reduce((s, r) => s + (r.gravadas_5_num || 0), 0),
    iva_5: filteredRgRows.reduce((s, r) => s + (r.iva_5_num || 0), 0),
    exentas: filteredRgRows.reduce((s, r) => s + (r.exentas_num || 0), 0),
    total: filteredRgRows.reduce((s, r) => s + (r.total_num || 0), 0),
  }), [filteredRgRows]);

  const filteredDiffs = useMemo(() => {
    let list = diffs;
    for (const col of DIFF_COLUMNAS) {
      const activo = diffColFiltros[col.key];
      if (activo) list = list.filter(d => activo.has(col.getValue(d)));
    }
    if (diffCategoryFilter) list = list.filter(d => d.diferencia === diffCategoryFilter);
    if (diffSearch.trim()) {
      const q = diffSearch.trim().toLowerCase();
      list = list.filter(d => Object.values(d).some(v => typeof v !== 'object' && String(v).toLowerCase().includes(q)));
    }
    return list;
  }, [diffs, diffSearch, diffCategoryFilter, diffColFiltros]);
  const hayDiffColFiltrosActivos = Object.values(diffColFiltros).some(v => v !== null && v !== undefined);

  // Excel de la grilla de resultado (Paso 3) — mismos labels del selector de columnas y
  // solo las filas que quedan tras los filtros de columna + categoría + búsqueda
  // (filteredDiffs ya viene con todo eso aplicado, ver arriba).
  const descargarDiffExcel = () => {
    if (filteredDiffs.length === 0) return;
    const headers = DIFF_COLUMNAS_PICKER.map(c => c.label);
    const dataRows = filteredDiffs.map(d => DIFF_COLUMNAS.map(col => col.getValue(d)));
    downloadExcel('Resultado_Comparacion_Compras_RG.xlsx', 'Resultado — Compras vs RG', headers, dataRows);
  };

  const CAMPOS_DIFF: (keyof CompraDiffLado)[] = ['gravada_10', 'gravada_5', 'iva_10', 'iva_5', 'exenta', 'total'];
  const diffTotales = useMemo(() => {
    const acc = { libro: {} as Record<string, number>, rg: {} as Record<string, number>, dif: {} as Record<string, number> };
    for (const campo of CAMPOS_DIFF) {
      acc.libro[campo] = filteredDiffs.reduce((s, d) => s + parseGs(valorCeldaDiff(d, 'libro', campo)), 0);
      acc.rg[campo] = filteredDiffs.reduce((s, d) => s + parseGs(valorCeldaDiff(d, 'rg', campo)), 0);
      acc.dif[campo] = acc.libro[campo] - acc.rg[campo];
    }
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDiffs]);

  // Columnas realmente visibles de cada grupo (según el selector de columnas) — se usan
  // tanto para el colSpan del encabezado agrupado como para mapear las celdas del cuerpo,
  // así no hay que repetir la lista de campos en cada lugar.
  const diffLibroColsVisibles = DIFF_COLUMNAS.filter(c => c.key.startsWith('libro_') && !diffColOcultas.has(c.key));
  const diffRgColsVisibles = DIFF_COLUMNAS.filter(c => c.key.startsWith('rg_') && !diffColOcultas.has(c.key));
  const diffDifColsVisibles = DIFF_COLUMNAS.filter(c => c.key.startsWith('dif_') && !diffColOcultas.has(c.key));

  // Valores de las 4 tarjetas resumen del Paso 3 — separado de RESUMEN_CATEGORIAS (los
  // rótulos, fijos) porque estos sí dependen del resultado de la comparación.
  const resumenValores: Record<string, number> = {
    'Coincide': summary?.coinciden ?? 0,
    'No llegó a la interfaz': summary?.no_en_rg ?? 0,
    'No en libro propio': summary?.no_en_libro ?? 0,
    'Diferencia de monto': summary?.diferencia_monto ?? 0,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '12px',
    padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  };
  const dropzoneStyle: React.CSSProperties = {
    flex: 1, border: '2px dashed #e2e0da', borderRadius: '9px', padding: '18px',
    textAlign: 'center', cursor: 'pointer', fontSize: '13px', color: '#5c6470', background: '#fafbfa',
  };
  const errorBoxStyle: React.CSSProperties = {
    marginTop: '14px', backgroundColor: '#fbe9e3', border: '1px solid #eec3b5', color: '#8a3a26',
    borderRadius: '8px', padding: '12px 14px', fontSize: '12.5px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <WizardSteps steps={wizardSteps} />

      {/* Paso 1: carga del libro y grilla */}
      {pasoMostrado === 1 && (
      <>
      <div style={navRowStyle}>
        <span />
        <button
          onClick={() => rows.length > 0 && setPasoMostrado(2)}
          disabled={rows.length === 0}
          style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px', ...(rows.length === 0 ? disabledBtnStyle : {}) }}
        >
          <span>Siguiente: Adjuntar RG90</span>
          <ArrowRight size={16} />
        </button>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>1. Adjuntar el libro de compras del sistema</h4>
          {archivos.length > 0 && puede('boton:compras.eliminar_todos') && (
            <button onClick={() => setConfirmEliminarTodos(true)} style={{ ...dangerBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash2 size={14} />
              <span>Eliminar todos</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={dropzoneStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <UploadCloud size={18} color="#128752" />
              <span>{archivos.length > 0 ? `${archivos.length} archivo(s) adjuntado(s) — click para agregar más` : 'Click para adjuntar el archivo (.xls, .xlsx)'}</span>
            </div>
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFileInput(e.target.files); e.target.value = ''; }}
            />
          </label>
          {puede('boton:compras.convertir') && (
            <button onClick={doConvertir} disabled={converting} style={{ ...primaryBtnStyle, opacity: converting ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              {converting ? 'Analizando…' : 'Analizar y convertir'}
            </button>
          )}
        </div>

        {archivos.length > 0 && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {archivos.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fafbfa', border: '1px solid #f0eee8', borderRadius: '7px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#22262b' }}>
                  <FileSpreadsheet size={14} color="#5c6470" />
                  <span>{a.fileName}</span>
                </div>
                <X size={14} style={{ cursor: 'pointer', color: '#9aa1ab' }} onClick={() => quitarArchivo(a.id)} />
              </div>
            ))}
          </div>
        )}

        {convertError && <div style={errorBoxStyle}>{convertError}</div>}
      </div>

      {/* Grilla del libro cargado — se queda en el paso 1, no es un paso aparte */}
      {rows.length > 0 && (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e0da', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafbfa', flexWrap: 'wrap', gap: '10px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>Libro de Compras ({filteredRows.length.toLocaleString('es-PY')} de {rows.length.toLocaleString('es-PY')} comprobantes)</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="text" placeholder="Buscar..." value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ padding: '7px 12px', border: '1px solid #e2e0da', borderRadius: '6px', fontSize: '12px', width: '200px' }}
              />
              {hayColFiltrosActivos && (
                <button onClick={() => { setColFiltros({}); setPage(1); }} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                  Limpiar filtros
                </button>
              )}
              {puede('boton:compras.descargar_csv') && (
                <button onClick={descargarExcel} style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={14} />
                  <span>Excel</span>
                </button>
              )}
              {puede('boton:compras.borrar_libro') && (
                <button onClick={borrarLibro} style={{ ...dangerBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={14} />
                  <span>Borrar libro</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  {LIBRO_COLUMNAS.map(col => {
                    const esImporte = ['gravadas', 'iva', 'gravadas_5', 'iva_5', 'exentas', 'total'].includes(col.key);
                    return (
                      <th key={col.key} style={{ padding: '10px 14px', fontWeight: 600, textAlign: esImporte ? 'right' : 'left' }}>
                        <ExcelFilterHeader
                          label={col.label}
                          allValues={rows.map(col.getValue)}
                          active={colFiltros[col.key] ?? null}
                          onChange={(next) => { setColFiltros(prev => ({ ...prev, [col.key]: next })); setPage(1); }}
                          align={esImporte ? 'right' : 'left'}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.local || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.fecha}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.ruc_proveedor}-{r.dv_proveedor} — {r.proveedor}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.tipo_doc}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.condicion || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.timbrado || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas_5}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva_5}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.exentas}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#22262b' }}>{r.total}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        background: r.estado === 'Anulada' ? '#fbe9e3' : '#e8f3ec',
                        color: r.estado === 'Anulada' ? '#b3402f' : '#128752',
                        fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                      }}>
                        {r.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e0da', backgroundColor: '#fafbfa', fontWeight: 700, color: '#22262b' }}>
                  <td colSpan={7} style={{ padding: '10px 14px' }}>Total ({filteredRows.length.toLocaleString('es-PY')} filas)</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.gravadas)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.iva)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.gravadas_5)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.iva_5)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.exentas)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', borderTop: '1px solid #f0eee8' }}>
              <button disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)} style={{ ...secondaryBtnStyle, opacity: currentPage <= 1 ? 0.5 : 1 }}>Anterior</button>
              <span style={{ fontSize: '12.5px', color: '#5c6470' }}>Página {currentPage} de {totalPages}</span>
              <button disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)} style={{ ...secondaryBtnStyle, opacity: currentPage >= totalPages ? 0.5 : 1 }}>Siguiente</button>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Paso 2: adjuntar la RG y listar sus datos */}
      {pasoMostrado === 2 && rows.length > 0 && (
      <>
      <div style={navRowStyle}>
        <button onClick={() => setPasoMostrado(1)} style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={16} />
          <span>Volver</span>
        </button>
        <button
          onClick={() => summary && setPasoMostrado(3)}
          disabled={!summary}
          style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px', ...(!summary ? disabledBtnStyle : {}) }}
        >
          <span>Siguiente: Ver resultado</span>
          <ArrowRight size={16} />
        </button>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitCompare size={20} color="#128752" />
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>2. Adjuntar la RG (SET) — Compras</h4>
            </div>
            <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
              Clave de comparación: documento + RUC del proveedor (sin dígito verificador) — un mismo número de documento puede repetirse entre proveedores distintos.
            </p>
          </div>
          {/* Misma posición y estilo en las 4 secciones de la app donde se adjuntan archivos
              (CargaView, RG90View, acá y el Paso 1 de esta misma vista): el botón que elimina
              todo lo adjuntado va en el header, junto al título. */}
          {rgFiles.length > 0 && puede('boton:compras.quitar_archivo') && (
            <button onClick={quitarRg} style={{ ...dangerBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash2 size={14} />
              <span>Eliminar todos</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={dropzoneStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <UploadCloud size={18} color="#128752" />
              <span>{rgFiles.length > 0 ? `${rgFiles.length} archivo(s) RG adjuntado(s)` : 'Click para adjuntar el archivo de la RG (compras)'}</span>
            </div>
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleRgFileInput(e.target.files); e.target.value = ''; }}
            />
          </label>
          {puede('boton:compras.comparar') && (
            <button onClick={doComparar} disabled={comparing} style={{ ...primaryBtnStyle, opacity: comparing ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              {comparing ? 'Comparando…' : 'Analizar y comparar'}
            </button>
          )}
        </div>

        {rgFiles.length > 0 && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rgFiles.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', background: '#fafbfa', border: '1px solid #f0eee8', borderRadius: '7px', fontSize: '12.5px', color: '#22262b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={14} color="#5c6470" />
                  <span>{f.name}</span>
                </div>
                <X size={14} style={{ cursor: 'pointer', color: '#9aa1ab' }} onClick={() => quitarRgArchivo(i)} />
              </div>
            ))}
          </div>
        )}

        {compareError && <div style={errorBoxStyle}>{compareError}</div>}
      </div>

      {/* Grilla de la RG cargada — igual que la del libro propio en el paso 1, para poder
          consultar ambos lados por separado antes de ver el resultado en el paso 3 */}
      {rgRows.length > 0 && (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e0da', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafbfa', flexWrap: 'wrap', gap: '10px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>RG (SET) — Compras ({filteredRgRows.length.toLocaleString('es-PY')} de {rgRows.length.toLocaleString('es-PY')} comprobantes)</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="text" placeholder="Buscar..." value={rgGridSearch}
                onChange={e => { setRgGridSearch(e.target.value); setRgGridPage(1); }}
                style={{ padding: '7px 12px', border: '1px solid #e2e0da', borderRadius: '6px', fontSize: '12px', width: '200px' }}
              />
              {hayRgColFiltrosActivos && (
                <button onClick={() => { setRgColFiltros({}); setRgGridPage(1); }} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                  Limpiar filtros
                </button>
              )}
              <button onClick={descargarRgExcel} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                Excel
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  {RG_COLUMNAS.map(col => {
                    const esImporte = ['gravadas', 'iva', 'gravadas_5', 'iva_5', 'exentas', 'total'].includes(col.key);
                    return (
                      <th key={col.key} style={{ padding: '10px 14px', fontWeight: 600, textAlign: esImporte ? 'right' : 'left' }}>
                        <ExcelFilterHeader
                          label={col.label}
                          allValues={rgRows.map(col.getValue)}
                          active={rgColFiltros[col.key] ?? null}
                          onChange={(next) => { setRgColFiltros(prev => ({ ...prev, [col.key]: next })); setRgGridPage(1); }}
                          align={esImporte ? 'right' : 'left'}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pagedRgRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.local || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.fecha}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.ruc_proveedor}{r.dv_proveedor ? `-${r.dv_proveedor}` : ''} — {r.proveedor}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.tipo_doc}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.condicion || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.timbrado || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas_5}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva_5}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.exentas}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#22262b' }}>{r.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e0da', backgroundColor: '#fafbfa', fontWeight: 700, color: '#22262b' }}>
                  <td colSpan={7} style={{ padding: '10px 14px' }}>Total ({filteredRgRows.length.toLocaleString('es-PY')} filas)</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.gravadas)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.iva)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.gravadas_5)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.iva_5)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.exentas)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {totalRgPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', borderTop: '1px solid #f0eee8' }}>
              <button disabled={currentRgPage <= 1} onClick={() => setRgGridPage(p => p - 1)} style={{ ...secondaryBtnStyle, opacity: currentRgPage <= 1 ? 0.5 : 1 }}>Anterior</button>
              <span style={{ fontSize: '12.5px', color: '#5c6470' }}>Página {currentRgPage} de {totalRgPages}</span>
              <button disabled={currentRgPage >= totalRgPages} onClick={() => setRgGridPage(p => p + 1)} style={{ ...secondaryBtnStyle, opacity: currentRgPage >= totalRgPages ? 0.5 : 1 }}>Siguiente</button>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Paso 3: resultado de la comparación */}
      {pasoMostrado === 3 && summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={navRowStyle}>
            <button onClick={() => setPasoMostrado(2)} style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} />
              <span>Volver</span>
            </button>
            <span />
          </div>

          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>3. Resultado de la comparación</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {RESUMEN_CATEGORIAS.map(c => {
              const activa = diffCategoryFilter === c.key;
              return (
                <div
                  key={c.key}
                  onClick={() => setDiffCategoryFilter(prev => (prev === c.key ? '' : c.key))}
                  style={{
                    backgroundColor: activa ? '#e8f3ec' : '#ffffff',
                    border: `1px solid ${activa ? '#128752' : '#e2e0da'}`,
                    borderRadius: '10px', padding: '16px 20px', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: activa ? '0 2px 8px rgba(18, 135, 82, 0.15)' : 'none',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>{c.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: c.color, marginTop: '4px' }}>{resumenValores[c.key]}</div>
                </div>
              );
            })}
          </div>

          {diffCategoryFilter && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                backgroundColor: '#e8f3ec', color: '#128752', fontSize: '11px', fontWeight: 600,
                padding: '4px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}>
                Filtro: {RESUMEN_CATEGORIAS.find(c => c.key === diffCategoryFilter)?.label ?? diffCategoryFilter}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => setDiffCategoryFilter('')} />
              </span>
            </div>
          )}

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e0da', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafbfa' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>Detalle de Discrepancias ({filteredDiffs.length.toLocaleString('es-PY')} de {diffs.length.toLocaleString('es-PY')})</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {hayDiffColFiltrosActivos && (
                  <button onClick={() => setDiffColFiltros({})} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                    Limpiar filtros
                  </button>
                )}
                <ColumnPicker columnas={DIFF_COLUMNAS_PICKER} ocultas={diffColOcultas} onChange={setDiffColOcultas} />
                <button
                  onClick={descargarDiffExcel}
                  disabled={filteredDiffs.length === 0}
                  style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileSpreadsheet size={14} color="#5c6470" />
                  <span>Excel</span>
                </button>
                <input
                  type="text" placeholder="Buscar por doc, proveedor..." value={diffSearch}
                  onChange={e => setDiffSearch(e.target.value)}
                  style={{ padding: '7px 12px', border: '1px solid #e2e0da', borderRadius: '6px', fontSize: '12px', width: '220px' }}
                />
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  {DIFF_COLUMNAS.filter(c => ['doc', 'proveedor', 'local'].includes(c.key) && !diffColOcultas.has(c.key)).map(col => (
                    <th key={col.key} rowSpan={2} style={{ padding: '10px 14px', fontWeight: 600, verticalAlign: 'bottom' }}>
                      <ExcelFilterHeader
                        label={col.label}
                        allValues={diffs.map(col.getValue)}
                        active={diffColFiltros[col.key] ?? null}
                        onChange={(next) => setDiffColFiltros(prev => ({ ...prev, [col.key]: next }))}
                      />
                    </th>
                  ))}
                  {diffLibroColsVisibles.length > 0 && (
                    <th colSpan={diffLibroColsVisibles.length} style={{ padding: '8px 14px', fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #e2e0da', color: '#22262b' }}>Libro de Compras</th>
                  )}
                  {diffRgColsVisibles.length > 0 && (
                    <th colSpan={diffRgColsVisibles.length} style={{ padding: '8px 14px', fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #e2e0da', color: '#22262b' }}>RG (SET)</th>
                  )}
                  {diffDifColsVisibles.length > 0 && (
                    <th colSpan={diffDifColsVisibles.length} style={{ padding: '8px 14px', fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #e2e0da', color: '#22262b' }}>Diferencia (Libro − RG)</th>
                  )}
                  {!diffColOcultas.has('diferencia') && (
                    <th rowSpan={2} style={{ padding: '10px 14px', fontWeight: 600, verticalAlign: 'bottom', borderLeft: '2px solid #e2e0da' }}>
                      {(() => {
                        const col = DIFF_COLUMNAS.find(c => c.key === 'diferencia')!;
                        return (
                          <ExcelFilterHeader
                            label={col.label}
                            allValues={diffs.map(col.getValue)}
                            active={diffColFiltros[col.key] ?? null}
                            onChange={(next) => setDiffColFiltros(prev => ({ ...prev, [col.key]: next }))}
                          />
                        );
                      })()}
                    </th>
                  )}
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  {[diffLibroColsVisibles, diffRgColsVisibles, diffDifColsVisibles].flatMap(grupo => grupo.map((col, i) => (
                    <th key={col.key} style={{ padding: '8px 14px', fontWeight: 600, textAlign: 'right', ...(i === 0 ? { borderLeft: '2px solid #e2e0da' } : {}) }}>
                      <ExcelFilterHeader
                        label={col.label}
                        allValues={diffs.map(col.getValue)}
                        active={diffColFiltros[col.key] ?? null}
                        onChange={(next) => setDiffColFiltros(prev => ({ ...prev, [col.key]: next }))}
                        align="right"
                      />
                    </th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {filteredDiffs.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                    {!diffColOcultas.has('doc') && <td style={{ padding: '10px 14px', fontWeight: 600, color: '#22262b' }}>{d.doc}</td>}
                    {!diffColOcultas.has('proveedor') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{d.proveedor}</td>}
                    {!diffColOcultas.has('local') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{d.local}</td>}
                    {[diffLibroColsVisibles, diffRgColsVisibles, diffDifColsVisibles].flatMap(grupo => grupo.map((col, i) => (
                      <td
                        key={col.key}
                        style={{
                          padding: '10px 14px', textAlign: 'right', color: '#5c6470',
                          ...(i === 0 ? { borderLeft: '2px solid #f0eee8' } : {}),
                          ...(col.key.endsWith('_total') ? { fontWeight: 600, color: '#22262b' } : {}),
                        }}
                      >
                        {col.getValue(d)}
                      </td>
                    )))}
                    {!diffColOcultas.has('diferencia') && (
                      <td style={{ padding: '10px 14px', borderLeft: '2px solid #f0eee8' }}>
                        <span style={{
                          background: d.diferencia === 'Coincide' ? '#e8f3ec' : d.diferencia === 'Diferencia de monto' ? '#fdf1de' : '#fbe9e3',
                          color: d.diferencia === 'Coincide' ? '#128752' : d.diferencia === 'Diferencia de monto' ? '#b0740f' : '#b3402f',
                          fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap',
                        }}>
                          {d.diferencia}
                          {d.diferencias_detalle ? ` (${Object.keys(d.diferencias_detalle).join(', ')})` : ''}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e0da', backgroundColor: '#fafbfa', fontWeight: 700, color: '#22262b' }}>
                  <td colSpan={['doc', 'proveedor', 'local'].filter(k => !diffColOcultas.has(k)).length} style={{ padding: '10px 14px' }}>Total ({filteredDiffs.length.toLocaleString('es-PY')} filas)</td>
                  {diffLibroColsVisibles.map((col, i) => (
                    <td key={col.key} style={{ padding: '10px 14px', textAlign: 'right', ...(i === 0 ? { borderLeft: '2px solid #e2e0da' } : {}) }}>
                      {formatGs(diffTotales.libro[col.key.replace('libro_', '')])}
                    </td>
                  ))}
                  {diffRgColsVisibles.map((col, i) => (
                    <td key={col.key} style={{ padding: '10px 14px', textAlign: 'right', ...(i === 0 ? { borderLeft: '2px solid #e2e0da' } : {}) }}>
                      {formatGs(diffTotales.rg[col.key.replace('rg_', '')])}
                    </td>
                  ))}
                  {diffDifColsVisibles.map((col, i) => (
                    <td key={col.key} style={{ padding: '10px 14px', textAlign: 'right', ...(i === 0 ? { borderLeft: '2px solid #e2e0da' } : {}) }}>
                      {formatGs(diffTotales.dif[col.key.replace('dif_', '')])}
                    </td>
                  ))}
                  {!diffColOcultas.has('diferencia') && <td style={{ padding: '10px 14px', borderLeft: '2px solid #e2e0da' }} />}
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
        </div>
      )}

      {confirmEliminarTodos && (
        <ConfirmModal
          message={`¿Eliminar los ${archivos.length} archivos adjuntados? Vas a tener que volver a cargarlos.`}
          confirmLabel="Eliminar todos"
          onConfirm={doEliminarTodos}
          onClose={() => setConfirmEliminarTodos(false)}
        />
      )}

    </div>
  );
};
