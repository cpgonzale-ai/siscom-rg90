import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNavigate, useParams } from 'react-router-dom';
import {
  UploadCloud, Trash2, FileSpreadsheet, X, GitCompare, Download,
  ArrowLeft, ArrowRight, ChevronDown,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { ProcessingModal } from '../components/ProcessingModal';
import { ProgressModal } from '../components/ProgressModal';
import { WizardSteps } from '../components/WizardSteps';
import { ExcelFilterHeader } from '../components/ExcelFilterHeader';
import { ColumnPicker } from '../components/ColumnPicker';
import { Modal, secondaryBtnStyle, primaryBtnStyle, dangerBtnStyle, excelBtnStyle, navRowStyle, disabledBtnStyle, stickyTheadStyle, scrollableGridStyle } from '../components/Modal';
import type { Local, CompraRow, CompraDiffRow, CompraDiffLado } from '../services/api';
import { ingestComprasApi, reconcileComprasApi, exportarTablaExcelApi } from '../services/api';
import { formatGs } from '../utils/format';
import { idbGet, idbSet, COMPRAS_PERSIST_KEY } from '../utils/persistStore';
import { contarFilasAproximado, ejecutarConAvance } from '../utils/progreso';

interface ComprasViewProps {
  locales: Local[];
  permisos: Set<string>;
  // Identificador del usuario logueado (meInfo.id en App.tsx) — namespaces la clave de
  // persistencia en IndexedDB (ver claveCompras más abajo) para que en una PC compartida
  // el libro de un usuario nunca pueda terminar leyéndolo otro. Este componente solo se
  // monta cuando ya hay un usuario autenticado con permiso (ver el guard de ruta en
  // App.tsx), así que en la práctica siempre llega definido.
  usuarioId?: number;
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
//
// Bug real corregido acá (mismo fix que diferenciaCampoVentas en utils/diffVentasColumns.ts,
// Ventas): para una Nota de Crédito, el libro guarda el monto en NEGATIVO mientras que la RG
// siempre lo informa en positivo -- restar los valores CRUDOS (con signo) daba un número muy
// distinto al real. Se usa directamente el valor que el backend ya calculó correctamente al
// comparar (guardado en diferencias_detalle), en vez de recalcularlo acá con una resta que no
// contempla el signo de las NC.
const diferenciaCampo = (d: CompraDiffRow, campo: keyof CompraDiffLado): string => {
  if (d.diferencia === 'Diferencia de monto' && d.diferencias_detalle && campo in d.diferencias_detalle) {
    return formatGs(d.diferencias_detalle[campo]);
  }
  return formatGs(parseGs(valorCeldaDiff(d, 'libro', campo)) - parseGs(valorCeldaDiff(d, 'rg', campo)));
};

// Columnas de la grilla de resultado (paso 3), texto e importes — estos últimos con el
// mismo valor que se ve en cada celda (post v()/valorCeldaDiff), no el crudo del backend.
// Alto real (medido) de la primera fila del encabezado de la grilla de resultado — la
// segunda fila (Gravada/IVA/Exenta/Total de cada grupo) necesita este valor como su propio
// `top` sticky para quedar pegada justo debajo de la primera, no tapada por ella.
const DIFF_THEAD_ROW1_HEIGHT = 41;

const DIFF_COLUMNAS: { key: string; label: string; getValue: (d: CompraDiffRow) => string }[] = [
  { key: 'doc', label: 'Documento', getValue: d => d.doc },
  { key: 'tipo_doc', label: 'Tipo', getValue: d => d.tipo_doc },
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
  { key: 'tipo_doc', label: 'Tipo' },
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
  { key: 'No existe en el libro', label: 'Registros que no se encuentran en libro de compras', color: '#b3402f' },
  { key: 'Diferencia de monto', label: 'Registros con diferencia de monto', color: '#b0740f' },
];

export const ComprasView: React.FC<ComprasViewProps> = ({ locales, permisos, usuarioId }) => {
  const puede = (clave: string) => permisos.has(clave);

  // ── Paso 1: carga del export del sistema ────────────────────────────────
  const [archivos, setArchivos] = useState<ArchivoAdjunto[]>([]);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  // Indicador de avance mientras se analiza el Excel del libro de compras (doConvertir) --
  // ver ProgressModal/utils/progreso.ts (mismo mecanismo que RG90View para Ventas). null =
  // no hay ningún análisis de archivo en curso ahora mismo.
  const [libroProgress, setLibroProgress] = useState<{ percent: number; total: number } | null>(null);
  // Mismo mecanismo para "Analizar y comparar" (ver doComparar) -- leer/analizar la RG y
  // compararla contra el libro corren como un solo proceso, con una sola pantalla de
  // progreso, que arranca recién con el click (adjuntar el archivo no dispara nada, ver
  // handleRgFileInput). Mismo criterio ya aplicado a RG90View.tsx (Ventas).
  const [rgCompareProgress, setRgCompareProgress] = useState<{ percent: number; total: number } | null>(null);
  const [confirmEliminarTodos, setConfirmEliminarTodos] = useState(false);

  // ── Paso 1: libro procesado ──────────────────────────────────────────────
  const [rows, setRows] = useState<CompraRow[]>([]);
  const [loteId, setLoteId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [colFiltros, setColFiltros] = useState<Record<string, Set<string> | null>>({});
  // Visibilidad de columnas en pantalla — no afecta descargarExcel, que arma sus
  // headers/dataRows a mano desde filteredRows sin mirar este estado, así que el .xlsx
  // siempre trae las 14 columnas aunque el usuario tenga alguna oculta acá. Ocultas por
  // defecto: Gravada 10%, IVA 10%, Gravada 5%, IVA 5%, Exenta.
  const [libroColOcultas, setLibroColOcultas] = useState<Set<string>>(
    new Set(['gravadas', 'iva', 'gravadas_5', 'iva_5', 'exentas'])
  );

  // ── Paso 2: adjuntar RG y su propia grilla ──────────────────────────────
  const [rgFiles, setRgFiles] = useState<File[]>([]);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [rgRows, setRgRows] = useState<CompraRow[]>([]);
  const [rgGridSearch, setRgGridSearch] = useState('');
  const [rgGridPage, setRgGridPage] = useState(1);
  const [rgColFiltros, setRgColFiltros] = useState<Record<string, Set<string> | null>>({});
  // Mismo criterio que libroColOcultas de arriba, para la grilla de la RG (paso 2): no
  // afecta descargarRgExcel, que ignora este estado y exporta las 13 columnas siempre.
  const [rgColOcultas, setRgColOcultas] = useState<Set<string>>(
    new Set(['gravadas', 'iva', 'gravadas_5', 'iva_5', 'exentas'])
  );
  // Saltos de numeración DENTRO de la RG de compras misma (agrupados por proveedor) — no
  // hay control de correlatividad del libro propio acá (ver docstring de ComprasEngine).

  // ── Paso 3: resultado de la comparación ─────────────────────────────────
  const [diffs, setDiffs] = useState<CompraDiffRow[]>([]);
  const [summary, setSummary] = useState<{ coinciden: number; no_en_rg: number; no_en_libro: number; diferencia_monto: number } | null>(null);
  const [diffSearch, setDiffSearch] = useState('');
  const [diffCategoryFilter, setDiffCategoryFilter] = useState<string>('');
  const [diffColFiltros, setDiffColFiltros] = useState<Record<string, Set<string> | null>>({});
  // Mismo criterio que RG90View.tsx (Ventas): el Detalle de Discrepancias arranca
  // colapsado al entrar al Paso 3, solo se ve el resumen — se abre al tocar una pestaña de
  // total o el propio encabezado. El encabezado (buscador, columnas, Excel) sigue visible
  // esté abierto o cerrado.
  const [detalleAbierto, setDetalleAbierto] = useState(false);
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
  //
  // Ya no es un useState propio: se deriva de la URL (/compras/carga|rg|resultado), así
  // que F5 en el resultado de la comparación queda ahí mismo en vez de perder el lugar.
  // setPasoMostrado queda como una función que navega en vez de un setState real — así
  // ningún llamador de más abajo (hay varios: "Siguiente", "Volver", el wizard, etc.)
  // necesitó cambiar una sola línea.
  const navigate = useNavigate();
  const { paso: pasoParam } = useParams<{ paso?: string }>();
  const PASO_A_SEGMENTO: Record<1 | 2 | 3, string> = { 1: 'carga', 2: 'rg', 3: 'resultado' };
  const SEGMENTO_A_PASO: Record<string, 1 | 2 | 3> = { carga: 1, rg: 2, resultado: 3 };
  const pasoMostrado: 1 | 2 | 3 = SEGMENTO_A_PASO[pasoParam ?? 'carga'] ?? 1;
  const setPasoMostrado = (n: 1 | 2 | 3) => navigate(`/compras/${PASO_A_SEGMENTO[n]}`);

  // Persistencia del libro de Compras (ver src/utils/persistStore.ts): mismo criterio que
  // Ventas en App.tsx — si la página se recarga por accidente, el navegador se cuelga o se
  // cierra (o el usuario simplemente navega a otra pantalla del sidebar, que ya desmonta
  // este componente hoy), no se pierde el libro cargado ni el resultado de la comparación.
  // No se persisten archivos/rgFiles (objetos File del navegador, no serializables) — lo
  // que se recupera es el libro YA procesado. La limpieza al cerrar sesión la hace
  // App.tsx (handleLogout) directamente por clave, porque este componente ya se desmonta
  // solo al salir de la pantalla de Compras.
  const comprasHydratedRef = useRef(false);
  // Igual que ventasHydrated en App.tsx: versión-estado del ref de arriba, solo para que el
  // guard de reachability de más abajo se vuelva a evaluar justo cuando la hidratación
  // termina (un ref no dispara re-render por sí solo).
  const [comprasHydrated, setComprasHydrated] = useState(false);

  useEffect(() => {
    // Sin usuarioId todavía no se sabe de quién es la sesión — no tocar IndexedDB hasta
    // tenerlo (ver el mismo criterio y el porqué en el efecto equivalente de App.tsx/
    // Ventas). Namespacea la clave por usuario para que en una PC compartida el libro de
    // un usuario nunca pueda terminar mostrándosele a otro.
    if (usuarioId === undefined) return;
    const claveCompras = `${COMPRAS_PERSIST_KEY}:${usuarioId}`;
    (async () => {
      try {
        const saved = await idbGet<{
          rows: CompraRow[];
          loteId?: number;
          rgRows: CompraRow[];
          diffs: CompraDiffRow[];
          summary: typeof summary;
        }>(claveCompras);
        // El paso actual vive en una clave APARTE y chica (ver el efecto de guardado, más
        // abajo, para el porqué) — se lee por separado y se combina acá con el resto.
        const pasoGuardado = await idbGet<1 | 2 | 3>(`${claveCompras}:paso`);
        if (saved) {
          setRows(saved.rows ?? []);
          setLoteId(saved.loteId);
          setRgRows(saved.rgRows ?? []);
          setDiffs(saved.diffs ?? []);
          setSummary(saved.summary ?? null);
        }
        // A diferencia de Ventas (App.tsx), acá SÍ es seguro navegar al paso guardado
        // apenas termina de hidratar: este componente solo existe montado mientras la
        // URL ya está en /compras/*, así que como mucho reubica al usuario DENTRO de
        // Compras (nunca lo saca de otra pantalla) — mismo comportamiento de "retomar
        // donde quedó" que ya tenía antes de este cambio.
        if ((pasoGuardado ?? 1) !== 1) setPasoMostrado(pasoGuardado ?? 1);
      } catch {
        // idbGet ya atrapa sus propios errores internamente (ver persistStore.ts) y nunca
        // debería rechazar — este catch es solo una red de seguridad si ese contrato cambia.
      } finally {
        comprasHydratedRef.current = true;
        setComprasHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  useEffect(() => {
    if (!comprasHydratedRef.current || usuarioId === undefined) return;
    const claveCompras = `${COMPRAS_PERSIST_KEY}:${usuarioId}`;
    const t = setTimeout(() => {
      idbSet(claveCompras, { rows, loteId, rgRows, diffs, summary });
    }, 400);
    return () => clearTimeout(t);
  }, [usuarioId, rows, loteId, rgRows, diffs, summary]);

  // Guardado APARTE, chico, solo para el paso actual — a propósito NO comparte efecto ni
  // dependencias con el de arriba. pasoMostrado viene de la URL y cambia con cada click
  // entre pasos aunque rows/rgRows/diffs no cambien nada; si estuviera en las mismas
  // dependencias que el guardado de arriba, cada click entre pasos volvería a serializar
  // y escribir TODO el libro (rows/rgRows/diffs, que pueden ser decenas de miles de filas)
  // solo para actualizar un número. Medido con un archivo de 100.000 filas: 1-3 segundos
  // de bloqueo real del navegador por click, solo por esto. Al ser un valor chico (un
  // número), no hace falta debounce.
  useEffect(() => {
    if (!comprasHydratedRef.current || usuarioId === undefined) return;
    idbSet(`${COMPRAS_PERSIST_KEY}:${usuarioId}:paso`, pasoMostrado);
  }, [usuarioId, pasoMostrado]);

  // pasoActual = el progreso real alcanzado (para los "✓" de completado en la barra),
  // independiente de qué paso se esté mostrando en pantalla en este momento.
  const pasoActual = rows.length === 0 ? 1 : !summary ? 2 : 3;

  // Guard de navegación: si la URL pide un paso que todavía no es alcanzable con los datos
  // reales (ej. entrar por link directo a /compras/resultado sin haber comparado nunca),
  // se redirige al paso correcto — MISMA regla "reachable" que ya usa la barra de abajo, no
  // una nueva. Espera a que termine la hidratación para no redirigir con el estado vacío
  // inicial, antes de que la persistencia tuviera chance de restaurar el libro real.
  useEffect(() => {
    if (!comprasHydrated) return;
    if (pasoMostrado > pasoActual) {
      navigate(`/compras/${PASO_A_SEGMENTO[pasoActual as 1 | 2 | 3]}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comprasHydrated, pasoMostrado, pasoActual]);

  const wizardSteps = [
    { n: 1 as const, label: 'Cargar el libro de compras' },
    { n: 2 as const, label: 'Adjuntar RG90' },
    { n: 3 as const, label: 'Ver resultado' },
  ].map(st => {
    const active = st.n === pasoMostrado;
    // !active primero: sin esto, al volver a ver un paso ya completado (ej. Paso 1 recién
    // convertido, o Paso 2 recién comparado) el círculo mostraba el ✓ verde de "completado"
    // en vez del resaltado naranja de "acá estás parado ahora" — mismo bug ya corregido en
    // el wizard de Ventas (App.tsx).
    const done = !active && st.n < pasoActual;
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
    // Total aproximado (SheetJS, en el navegador) para el indicador "Procesados: X de Y" --
    // ver contarFilasAproximado. Puramente visual, no participa en ninguna regla de negocio.
    const totalAprox = await contarFilasAproximado(archivos.map(a => a.rawFile));
    setLibroProgress({ percent: 0, total: totalAprox });
    try {
      const res = await ejecutarConAvance(
        (onUploadProgress) => ingestComprasApi(archivos.map(a => a.rawFile), 'Local General', onUploadProgress),
        (f) => setLibroProgress(p => (p ? { ...p, percent: f * 100 } : p)),
      );
      const rowsConLocal = (res.rows || []).map(r => ({ ...r, local: resolveLocal(r.codigo_sucursal) }));
      setRows(rowsConLocal);
      setLoteId(res.lote_id);
      setPage(1);
      if (!res.rows || res.rows.length === 0) {
        setConvertError('El servidor procesó el/los archivo(s) pero no encontró ningún comprobante válido. Revisá que sea el reporte de compras del sistema, sin editar a mano.');
      }
      // Recién con el archivo COMPLETAMENTE analizado se completa la barra al 100%, se
      // espera un instante para que se perciba como terminada, y solo entonces se revela el
      // resultado -- mismo criterio que doConvert en App.tsx (Ventas).
      setLibroProgress(p => (p ? { ...p, percent: 100 } : p));
      await new Promise(resolve => setTimeout(resolve, 350));
      // Se queda en el paso 1 mostrando la grilla — el usuario avanza al paso 2 con el
      // botón "Siguiente" cuando ya revisó el libro, no de forma automática.
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : 'Error al procesar los archivos en el servidor.');
    } finally {
      setConverting(false);
      setLibroProgress(null);
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
    // Total aproximado (SheetJS, en el navegador) para "Procesados: X de Y" -- ver
    // contarFilasAproximado. Puramente visual, no participa en ninguna regla de negocio.
    setRgCompareProgress({ percent: 0, total: 0 });
    const totalAprox = (await contarFilasAproximado(rgFiles)) + rows.length;
    setRgCompareProgress(p => (p ? { ...p, total: totalAprox } : p));
    try {
      const res = await ejecutarConAvance(
        (onUploadProgress) => reconcileComprasApi(rgFiles, rows, loteId, onUploadProgress),
        (f) => setRgCompareProgress(p => (p ? { ...p, percent: f * 100 } : p)),
      );
      setRgRows(res.rg_rows || []);
      setRgGridPage(1);
      setDiffs(res.diffs || []);
      setSummary(res.summary);
      setDiffCategoryFilter('');
      setDiffColFiltros({});
      // Se queda en el paso 2, listando los datos de la RG — el usuario avanza al paso 3
      // con "Siguiente" cuando quiera ver el resultado de la comparación, igual que en el
      // paso 1 (analiza y lista ahí mismo, sin avanzar solo).
      setRgCompareProgress(p => (p ? { ...p, percent: 100 } : p));
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : 'Error al comparar contra la RG.');
    } finally {
      setComparing(false);
      setRgCompareProgress(null);
    }
  };

  // Si hay filtro de columna o búsqueda activo, se descarga solo lo que queda filtrado en
  // la grilla (filteredRows/filteredRgRows, definidas más abajo); sin filtros, ambas son
  // iguales a la lista completa, así que esto también cubre "descargar todo".
  // Antes usaba downloadExcel (SheetJS, arma el .xlsx completo en el navegador de forma
  // síncrona) — mismo problema ya medido y resuelto para el Detalle de Discrepancias de
  // Ventas (4,25s bloqueado con 20.000 filas, escala mucho peor con archivos reales de
  // 50.000-100.000+), nunca extendido acá. Se cambia a exportarTablaExcelApi (backend,
  // streaming) — mismo endpoint ya probado que usa RG90View. Mismos headers/filas, ningún
  // cálculo cambia, solo dónde se arma el archivo.
  // Mismo criterio que exportandoRg90/exportandoDiff en RG90View.tsx (Ventas): mientras el
  // backend arma el archivo, el botón muestra "Generando Excel…" y queda deshabilitado, para
  // que el usuario sepa que está procesando y no dispare varios pedidos a la vez clickeando
  // de nuevo con archivos grandes (el backend puede tardar un rato real, ver docstring de
  // app/api/export.py).
  const [exportandoLibro, setExportandoLibro] = useState(false);
  const [exportandoRg, setExportandoRg] = useState(false);

  const descargarExcel = async () => {
    if (filteredRows.length === 0 || exportandoLibro) return;
    const headers = ['Documento', 'Local', 'Fecha', 'RUC Proveedor', 'Proveedor', 'Tipo', 'Condición', 'Timbrado', 'Gravada 10%', 'IVA 10%', 'Gravada 5%', 'IVA 5%', 'Exenta', 'Total', 'Estado'];
    // Importes con el mismo texto ya formateado de la grilla (r.gravadas, no un number) —
    // el Excel descargado coincide con la pantalla tal cual, sin riesgo de que se invierta
    // coma y punto al abrirlo.
    const dataRows = filteredRows.map(r => [
      r.doc, r.local, r.fecha, `${r.ruc_proveedor}-${r.dv_proveedor}`, r.proveedor, r.tipo_doc, r.condicion, r.timbrado,
      r.gravadas, r.iva, r.gravadas_5, r.iva_5, r.exentas, r.total, r.estado,
    ]);
    setExportandoLibro(true);
    try {
      await exportarTablaExcelApi('Libro_de_Compras.xlsx', 'Libro de Compras', headers, dataRows);
    } catch (e) {
      console.error('Error al exportar el Libro de Compras a Excel:', e);
    } finally {
      setExportandoLibro(false);
    }
  };

  const descargarRgExcel = async () => {
    if (filteredRgRows.length === 0 || exportandoRg) return;
    const headers = ['Documento', 'Local', 'Fecha', 'RUC Proveedor', 'Proveedor', 'Tipo', 'Condición', 'Timbrado', 'Gravada 10%', 'IVA 10%', 'Gravada 5%', 'IVA 5%', 'Exenta', 'Total'];
    const dataRows = filteredRgRows.map(r => [
      r.doc, r.local, r.fecha, r.dv_proveedor ? `${r.ruc_proveedor}-${r.dv_proveedor}` : r.ruc_proveedor, r.proveedor, r.tipo_doc, r.condicion, r.timbrado,
      r.gravadas, r.iva, r.gravadas_5, r.iva_5, r.exentas, r.total,
    ]);
    setExportandoRg(true);
    try {
      await exportarTablaExcelApi('RG_Compras.xlsx', 'RG (SET) — Compras', headers, dataRows);
    } catch (e) {
      console.error('Error al exportar la RG de Compras a Excel:', e);
    } finally {
      setExportandoRg(false);
    }
  };

  // allValues por columna para cada uno de los 3 desplegables de filtro (Libro, RG,
  // Diferencias) — memoizado por separado de filteredRows/filteredRgRows/filteredDiffs de
  // abajo, con dependencia SOLO en el array fuente correspondiente. Mismo criterio que
  // rg90GridAllValuesPorColumna en App.tsx (ver hallazgo F1 de /auditoria/05-performance.md):
  // sin esto, ExcelFilterHeader recibía un array nuevo en cada render y su propio useMemo
  // interno quedaba inefectivo. LIBRO_COLUMNAS/RG_COLUMNAS/DIFF_COLUMNAS son constantes de
  // módulo (getValue estables entre renders).
  const rowsAllValuesPorColumna = useMemo(
    () => Object.fromEntries(LIBRO_COLUMNAS.map(col => [col.key, rows.map(col.getValue)])),
    [rows]
  );
  const rgRowsAllValuesPorColumna = useMemo(
    () => Object.fromEntries(RG_COLUMNAS.map(col => [col.key, rgRows.map(col.getValue)])),
    [rgRows]
  );
  const diffsAllValuesPorColumna = useMemo(
    () => Object.fromEntries(DIFF_COLUMNAS.map(col => [col.key, diffs.map(col.getValue)])),
    [diffs]
  );

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

  // useDeferredValue en vez de filtrar con cada tecla directamente — mismo criterio que
  // rg90SearchDeferred en App.tsx/RG90View (Ventas): con miles de discrepancias, filtrar en
  // el mismo render que la tecla bloqueaba el input mientras se recalculaba filteredDiffs
  // completo. React usa este valor diferido para el filtro pesado y prioriza que el input
  // siga respondiendo al tipeo.
  const diffSearchDeferred = useDeferredValue(diffSearch);
  const filteredDiffs = useMemo(() => {
    let list = diffs;
    for (const col of DIFF_COLUMNAS) {
      const activo = diffColFiltros[col.key];
      if (activo) list = list.filter(d => activo.has(col.getValue(d)));
    }
    if (diffCategoryFilter) list = list.filter(d => d.diferencia === diffCategoryFilter);
    if (diffSearchDeferred.trim()) {
      const q = diffSearchDeferred.trim().toLowerCase();
      list = list.filter(d => Object.values(d).some(v => typeof v !== 'object' && String(v).toLowerCase().includes(q)));
    }
    return list;
  }, [diffs, diffSearchDeferred, diffCategoryFilter, diffColFiltros]);
  const hayDiffColFiltrosActivos = Object.values(diffColFiltros).some(v => v !== null && v !== undefined);

  // Excel de la grilla de resultado (Paso 3) — mismos labels del selector de columnas y
  // solo las filas que quedan tras los filtros de columna + categoría + búsqueda
  // (filteredDiffs ya viene con todo eso aplicado, ver arriba).
  // El cálculo por celda (col.getValue) ya lo hace el frontend acá abajo, barato — lo único
  // que colgaba el navegador era el paso final de armar el .xlsx en sí (downloadExcel/
  // SheetJS, síncrono). Mismo cambio que descargarExcel/descargarRgExcel: se manda el mismo
  // headers+dataRows ya armado al endpoint genérico del backend en vez de a SheetJS.
  const [exportandoDiff, setExportandoDiff] = useState(false);
  const descargarDiffExcel = async () => {
    if (filteredDiffs.length === 0 || exportandoDiff) return;
    const headers = DIFF_COLUMNAS_PICKER.map(c => c.label);
    const dataRows = filteredDiffs.map(d => DIFF_COLUMNAS.map(col => col.getValue(d)));
    setExportandoDiff(true);
    try {
      await exportarTablaExcelApi('Resultado_Comparacion_Compras_RG.xlsx', 'Resultado — Compras vs RG', headers, dataRows);
    } catch (e) {
      console.error('Error al exportar el resultado de Compras a Excel:', e);
    } finally {
      setExportandoDiff(false);
    }
  };

  const CAMPOS_DIFF: (keyof CompraDiffLado)[] = ['gravada_10', 'gravada_5', 'iva_10', 'iva_5', 'exenta', 'total'];
  const diffTotales = useMemo(() => {
    const acc = { libro: {} as Record<string, number>, rg: {} as Record<string, number>, dif: {} as Record<string, number> };
    for (const campo of CAMPOS_DIFF) {
      acc.libro[campo] = filteredDiffs.reduce((s, d) => s + parseGs(valorCeldaDiff(d, 'libro', campo)), 0);
      acc.rg[campo] = filteredDiffs.reduce((s, d) => s + parseGs(valorCeldaDiff(d, 'rg', campo)), 0);
      // Mismo fix que en RG90View.tsx (Ventas): sumar el mismo valor por fila que ya se ve
      // en la grilla (diferenciaCampo, que usa diferencias_detalle cuando está disponible)
      // en vez de restar las sumas agregadas de libro/rg -- para una Nota de Crédito eso
      // daba un total con el signo invertido respecto de lo que mostraba cada fila.
      acc.dif[campo] = filteredDiffs.reduce((s, d) => s + parseGs(diferenciaCampo(d, campo)), 0);
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

  // Virtualización de la grilla de Discrepancias — mismo criterio y misma técnica que ya
  // usa la equivalente de Ventas (RG90View.tsx, ver el comentario ahí sobre el hallazgo de
  // performance real con 200.000 filas): esta tabla vive en un Modal que antes renderizaba
  // TODAS las filas filtradas con .map() de una sola vez — con miles de comprobantes
  // comparados, eso creaba miles de nodos <tr> en el mismo render que abre el modal,
  // bloqueando el hilo principal justo en ese instante. Filas espaciadoras
  // (padding-top/bottom) en vez de position:absolute, por lo mismo que en RG90View: los
  // hijos de <tbody> no respetan position:absolute de forma confiable, y así el layout de
  // la tabla real (thead de dos filas sticky, tfoot con totales) no se toca.
  const diffScrollRef = useRef<HTMLDivElement>(null);
  const diffRowVirtualizer = useVirtualizer({
    count: filteredDiffs.length,
    getScrollElement: () => diffScrollRef.current,
    // 58px medido en el navegador real (getBoundingClientRect().height de un <tr> real de
    // esta tabla) — mismo criterio que RG90View.tsx: la fila es de una sola línea (importes
    // y el chip de diagnóstico no envuelven a dos líneas), así que un valor fijo exacto
    // evita el desfasaje de estimar de más/de menos.
    estimateSize: () => 58,
    overscan: 15,
  });
  const diffVirtualItems = diffRowVirtualizer.getVirtualItems();
  const diffPaddingTop = diffVirtualItems.length > 0 ? diffVirtualItems[0].start : 0;
  const diffPaddingBottom = diffVirtualItems.length > 0
    ? diffRowVirtualizer.getTotalSize() - diffVirtualItems[diffVirtualItems.length - 1].end
    : 0;
  const DIFF_COLSPAN_ESPACIADOR = 30;

  // Valores de las 4 tarjetas resumen del Paso 3 — separado de RESUMEN_CATEGORIAS (los
  // rótulos, fijos) porque estos sí dependen del resultado de la comparación.
  const resumenValores: Record<string, number> = {
    'Coincide': summary?.coinciden ?? 0,
    'No llegó a la interfaz': summary?.no_en_rg ?? 0,
    'No existe en el libro': summary?.no_en_libro ?? 0,
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
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>1. Adjuntar el libro de compras del sistema</h4>
            {/* Mismo criterio que convertHelpText en App.tsx (Ventas): archivos (el File
                crudo) no sobrevive un F5 — pero si rows ya tiene datos, hubo un análisis
                real que no se perdió, solo no queda el nombre del archivo original para
                mostrar. Sin esto, tras recargar la pantalla parecía "vacía" aunque la
                grilla de abajo siguiera mostrando el libro completo. */}
            {archivos.length === 0 && rows.length > 0 && (
              <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
                Ya existe un análisis generado para este libro.
              </p>
            )}
          </div>
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
              <ColumnPicker columnas={LIBRO_COLUMNAS} ocultas={libroColOcultas} onChange={setLibroColOcultas} />
              {hayColFiltrosActivos && (
                <button onClick={() => { setColFiltros({}); setPage(1); }} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                  Limpiar filtros
                </button>
              )}
              {puede('boton:compras.descargar_csv') && (
                <button
                  onClick={descargarExcel}
                  disabled={exportandoLibro}
                  style={{ ...excelBtnStyle, display: 'flex', alignItems: 'center', gap: '6px', ...(exportandoLibro ? { opacity: 0.7, cursor: 'wait' } : {}) }}
                >
                  <Download size={14} color="#fff" />
                  <span>{exportandoLibro ? 'Generando Excel…' : 'Excel'}</span>
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

          <div style={scrollableGridStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  {LIBRO_COLUMNAS.filter(col => !libroColOcultas.has(col.key)).map(col => {
                    const esImporte = ['gravadas', 'iva', 'gravadas_5', 'iva_5', 'exentas', 'total'].includes(col.key);
                    return (
                      <th key={col.key} style={{ ...stickyTheadStyle, padding: '10px 14px', fontWeight: 600, textAlign: esImporte ? 'right' : 'left' }}>
                        <ExcelFilterHeader
                          label={col.label}
                          allValues={rowsAllValuesPorColumna[col.key]}
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
                    {!libroColOcultas.has('doc') && <td style={{ padding: '10px 14px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>}
                    {!libroColOcultas.has('local') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.local || '—'}</td>}
                    {!libroColOcultas.has('fecha') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.fecha}</td>}
                    {!libroColOcultas.has('proveedor') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.ruc_proveedor}-{r.dv_proveedor} — {r.proveedor}</td>}
                    {!libroColOcultas.has('tipo_doc') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.tipo_doc}</td>}
                    {!libroColOcultas.has('condicion') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.condicion || '—'}</td>}
                    {!libroColOcultas.has('timbrado') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.timbrado || '—'}</td>}
                    {!libroColOcultas.has('gravadas') && <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas}</td>}
                    {!libroColOcultas.has('iva') && <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva}</td>}
                    {!libroColOcultas.has('gravadas_5') && <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas_5}</td>}
                    {!libroColOcultas.has('iva_5') && <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva_5}</td>}
                    {!libroColOcultas.has('exentas') && <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.exentas}</td>}
                    {!libroColOcultas.has('total') && <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#22262b' }}>{r.total}</td>}
                    {!libroColOcultas.has('estado') && (
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          background: r.estado === 'Anulada' ? '#fbe9e3' : '#e8f3ec',
                          color: r.estado === 'Anulada' ? '#b3402f' : '#128752',
                          fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                        }}>
                          {r.estado}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e0da', backgroundColor: '#fafbfa', fontWeight: 700, color: '#22262b' }}>
                  <td colSpan={['doc', 'local', 'fecha', 'proveedor', 'tipo_doc', 'condicion', 'timbrado'].filter(k => !libroColOcultas.has(k)).length} style={{ padding: '10px 14px' }}>Total ({filteredRows.length.toLocaleString('es-PY')} filas)</td>
                  {!libroColOcultas.has('gravadas') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.gravadas)}</td>}
                  {!libroColOcultas.has('iva') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.iva)}</td>}
                  {!libroColOcultas.has('gravadas_5') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.gravadas_5)}</td>}
                  {!libroColOcultas.has('iva_5') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.iva_5)}</td>}
                  {!libroColOcultas.has('exentas') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.exentas)}</td>}
                  {!libroColOcultas.has('total') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rowsTotales.total)}</td>}
                  {!libroColOcultas.has('estado') && <td />}
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
            {/* Mismo criterio que el aviso equivalente del Paso 1, más arriba. */}
            {rgFiles.length === 0 && rgRows.length > 0 && (
              <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '4px' }}>
                Ya existe un análisis generado para esta RG.
              </p>
            )}
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
              <ColumnPicker columnas={RG_COLUMNAS} ocultas={rgColOcultas} onChange={setRgColOcultas} />
              {hayRgColFiltrosActivos && (
                <button onClick={() => { setRgColFiltros({}); setRgGridPage(1); }} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                  Limpiar filtros
                </button>
              )}
              <button
                onClick={descargarRgExcel}
                disabled={exportandoRg}
                style={{ ...excelBtnStyle, padding: '7px 12px', fontSize: '12px', ...(exportandoRg ? { opacity: 0.7, cursor: 'wait' } : {}) }}
              >
                {exportandoRg ? 'Generando Excel…' : 'Excel'}
              </button>
              {/* Mismo criterio que "Borrar libro" en la grilla del Paso 1: antes la única
                  forma de sacar la RG era "Eliminar todos" en el recuadro de carga de más
                  arriba, atado a rgFiles (el archivo crudo) — que no sobrevive un F5 ni queda
                  restaurado por la persistencia (ver persistStore.ts). Sin este botón, una
                  vez recargada la página no había forma de rehacer la RG aunque los datos ya
                  procesados (rgRows) sí estuvieran ahí. */}
              {puede('boton:compras.quitar_archivo') && (
                <button onClick={quitarRg} style={{ ...dangerBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={14} />
                  <span>Borrar RG</span>
                </button>
              )}
            </div>
          </div>

          <div style={scrollableGridStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  {RG_COLUMNAS.filter(col => !rgColOcultas.has(col.key)).map(col => {
                    const esImporte = ['gravadas', 'iva', 'gravadas_5', 'iva_5', 'exentas', 'total'].includes(col.key);
                    return (
                      <th key={col.key} style={{ ...stickyTheadStyle, padding: '10px 14px', fontWeight: 600, textAlign: esImporte ? 'right' : 'left' }}>
                        <ExcelFilterHeader
                          label={col.label}
                          allValues={rgRowsAllValuesPorColumna[col.key]}
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
                    {!rgColOcultas.has('doc') && <td style={{ padding: '10px 14px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>}
                    {!rgColOcultas.has('local') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.local || '—'}</td>}
                    {!rgColOcultas.has('fecha') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.fecha}</td>}
                    {!rgColOcultas.has('proveedor') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.ruc_proveedor}{r.dv_proveedor ? `-${r.dv_proveedor}` : ''} — {r.proveedor}</td>}
                    {!rgColOcultas.has('tipo_doc') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.tipo_doc}</td>}
                    {!rgColOcultas.has('condicion') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.condicion || '—'}</td>}
                    {!rgColOcultas.has('timbrado') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.timbrado || '—'}</td>}
                    {!rgColOcultas.has('gravadas') && <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas}</td>}
                    {!rgColOcultas.has('iva') && <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva}</td>}
                    {!rgColOcultas.has('gravadas_5') && <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas_5}</td>}
                    {!rgColOcultas.has('iva_5') && <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva_5}</td>}
                    {!rgColOcultas.has('exentas') && <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.exentas}</td>}
                    {!rgColOcultas.has('total') && <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#22262b' }}>{r.total}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e0da', backgroundColor: '#fafbfa', fontWeight: 700, color: '#22262b' }}>
                  <td colSpan={['doc', 'local', 'fecha', 'proveedor', 'tipo_doc', 'condicion', 'timbrado'].filter(k => !rgColOcultas.has(k)).length} style={{ padding: '10px 14px' }}>Total ({filteredRgRows.length.toLocaleString('es-PY')} filas)</td>
                  {!rgColOcultas.has('gravadas') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.gravadas)}</td>}
                  {!rgColOcultas.has('iva') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.iva)}</td>}
                  {!rgColOcultas.has('gravadas_5') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.gravadas_5)}</td>}
                  {!rgColOcultas.has('iva_5') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.iva_5)}</td>}
                  {!rgColOcultas.has('exentas') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.exentas)}</td>}
                  {!rgColOcultas.has('total') && <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatGs(rgRowsTotales.total)}</td>}
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

          {/* Panel de Desglose Matemático: no agrega ningún cálculo nuevo — solo reordena en
              dos columnas (Libro propio / RG) los mismos contadores que ya se ven arriba en
              resumenValores, para mostrar cómo se compone cada total. Mismo criterio que el
              panel equivalente de RG90View.tsx (Ventas), sin fila "Anulados": el campo
              "estado" de Compras es un placeholder fijo ("Válida") que no viene del export
              real del sistema (ver docstring de ComprasEngine), así que esa categoría nunca
              tiene datos reales acá. */}
          {(() => {
            const coinciden = resumenValores['Coincide'];
            const diferenciaMonto = resumenValores['Diferencia de monto'];
            const noEnRg = resumenValores['No llegó a la interfaz'];
            const noEnLibro = resumenValores['No existe en el libro'];
            const sumaLibro = coinciden + diferenciaMonto + noEnRg;
            const sumaRg = coinciden + diferenciaMonto + noEnLibro;

            const filaStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#5c6470' };
            const tarjetaStyle: React.CSSProperties = { backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' };
            const cabeceraStyle: React.CSSProperties = { backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', padding: '14px 20px' };

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                <div style={tarjetaStyle}>
                  <div style={{ ...cabeceraStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#22262b' }}>TU LIBRO DE COMPRAS</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#22262b' }}>
                      Total de comprobantes: {rows.length.toLocaleString('es-PY')}
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '12.5px', color: '#9aa1ab', marginBottom: '4px' }}>Este total se compone de:</div>
                    <div style={filaStyle}><span>Coinciden</span><span>{coinciden.toLocaleString('es-PY')}</span></div>
                    <div style={filaStyle}><span>Diferencia de monto</span><span>{diferenciaMonto.toLocaleString('es-PY')}</span></div>
                    <div style={filaStyle}><span>Registros que no se encuentran en la RG</span><span>{noEnRg.toLocaleString('es-PY')}</span></div>
                    <div style={{ ...filaStyle, borderTop: '1px solid #e2e0da', marginTop: '4px', paddingTop: '10px', fontWeight: 700, color: '#22262b' }}>
                      <span>Total</span><span>{sumaLibro.toLocaleString('es-PY')}</span>
                    </div>
                  </div>
                </div>

                <div style={tarjetaStyle}>
                  <div style={{ ...cabeceraStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#22262b' }}>ARCHIVO RG (SET)</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#22262b' }}>
                      Total de comprobantes: {rgRows.length.toLocaleString('es-PY')}
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '12.5px', color: '#9aa1ab', marginBottom: '4px' }}>Este total se compone de:</div>
                    <div style={filaStyle}><span>Coinciden</span><span>{coinciden.toLocaleString('es-PY')}</span></div>
                    <div style={filaStyle}><span>Diferencia de monto</span><span>{diferenciaMonto.toLocaleString('es-PY')}</span></div>
                    <div style={filaStyle}><span>Registros que no se encuentran en el libro</span><span>{noEnLibro.toLocaleString('es-PY')}</span></div>
                    <div style={{ ...filaStyle, borderTop: '1px solid #e2e0da', marginTop: '4px', paddingTop: '10px', fontWeight: 700, color: '#22262b' }}>
                      <span>Total</span><span>{sumaRg.toLocaleString('es-PY')}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Antes eran 4 cards grandes y sueltas arriba de todo. Ahora son pestañas
                chicas pegadas al borde superior de esta misma grilla — mismo
                setDiffCategoryFilter que ya tenía cada card (nada de lógica de filtro
                nueva), solo mucho más compactas y ancladas a lo que filtran. */}
            <div style={{ display: 'flex', alignItems: 'stretch', backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', overflowX: 'auto' }}>
              {RESUMEN_CATEGORIAS.map(c => {
                const activa = diffCategoryFilter === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => { setDiffCategoryFilter(prev => (prev === c.key ? '' : c.key)); setDetalleAbierto(true); }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                      padding: '9px 16px', border: 'none', borderRight: '1px solid #e2e0da',
                      borderBottom: `2px solid ${activa ? '#128752' : 'transparent'}`,
                      backgroundColor: activa ? '#ffffff' : 'transparent',
                      cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#9aa1ab', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{c.label}</span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: activa ? '#128752' : c.color }}>{resumenValores[c.key].toLocaleString('es-PY')}</span>
                  </button>
                );
              })}
            </div>

            {/* Ya no se expande in-line — demasiada información junta en la pantalla al
                abrirla ahí mismo. Ahora esta barra es solo el resumen; el detalle (buscador,
                columnas, Excel y la grilla) vive en el Modal de más abajo. Se abre tocando
                cualquier pestaña de arriba (ya llama a setDetalleAbierto(true)) o esta
                barra. */}
            <div
              style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafbfa', cursor: 'pointer' }}
              onClick={() => setDetalleAbierto(true)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ChevronDown size={16} color="#5c6470" />
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>Detalle de Discrepancias ({filteredDiffs.length.toLocaleString('es-PY')} de {diffs.length.toLocaleString('es-PY')})</h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button
                  onClick={e => { e.stopPropagation(); descargarDiffExcel(); }}
                  disabled={filteredDiffs.length === 0 || exportandoDiff}
                  style={{ ...excelBtnStyle, padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', ...(exportandoDiff ? { opacity: 0.7, cursor: 'wait' } : {}) }}
                >
                  <FileSpreadsheet size={14} color="#fff" />
                  <span>{exportandoDiff ? 'Generando Excel…' : 'Excel'}</span>
                </button>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#128752' }}>Ver detalle</span>
              </div>
            </div>
          </div>

          {detalleAbierto && (
            <Modal title="Detalle" onClose={() => setDetalleAbierto(false)} width="1400px">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '12.5px', color: '#5c6470' }}>
                  {filteredDiffs.length.toLocaleString('es-PY')} de {diffs.length.toLocaleString('es-PY')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {hayDiffColFiltrosActivos && (
                    <button onClick={() => setDiffColFiltros({})} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                      Limpiar filtros
                    </button>
                  )}
                  <ColumnPicker columnas={DIFF_COLUMNAS_PICKER} ocultas={diffColOcultas} onChange={setDiffColOcultas} />
                  <button
                    onClick={descargarDiffExcel}
                    disabled={filteredDiffs.length === 0 || exportandoDiff}
                    style={{ ...excelBtnStyle, padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', ...(exportandoDiff ? { opacity: 0.7, cursor: 'wait' } : {}) }}
                  >
                    <FileSpreadsheet size={14} color="#fff" />
                    <span>{exportandoDiff ? 'Generando Excel…' : 'Excel'}</span>
                  </button>
                  <input
                    type="text" placeholder="Buscar por doc, proveedor..." value={diffSearch}
                    onChange={e => setDiffSearch(e.target.value)}
                    style={{ padding: '7px 12px', border: '1px solid #e2e0da', borderRadius: '6px', fontSize: '12px', width: '220px' }}
                  />
                </div>
              </div>

            <div ref={diffScrollRef} style={{ ...scrollableGridStyle, border: '1px solid #e2e0da', borderRadius: '8px', maxHeight: '60vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  {DIFF_COLUMNAS.filter(c => ['doc', 'tipo_doc', 'proveedor', 'local'].includes(c.key) && !diffColOcultas.has(c.key)).map(col => (
                    <th key={col.key} rowSpan={2} style={{ ...stickyTheadStyle, padding: '10px 14px', fontWeight: 600, verticalAlign: 'bottom' }}>
                      <ExcelFilterHeader
                        label={col.label}
                        allValues={diffsAllValuesPorColumna[col.key]}
                        active={diffColFiltros[col.key] ?? null}
                        onChange={(next) => setDiffColFiltros(prev => ({ ...prev, [col.key]: next }))}
                      />
                    </th>
                  ))}
                  {diffLibroColsVisibles.length > 0 && (
                    <th colSpan={diffLibroColsVisibles.length} style={{ ...stickyTheadStyle, padding: '8px 14px', fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #e2e0da', color: '#22262b' }}>Libro de Compras</th>
                  )}
                  {diffRgColsVisibles.length > 0 && (
                    <th colSpan={diffRgColsVisibles.length} style={{ ...stickyTheadStyle, padding: '8px 14px', fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #e2e0da', color: '#22262b' }}>RG (SET)</th>
                  )}
                  {diffDifColsVisibles.length > 0 && (
                    <th colSpan={diffDifColsVisibles.length} style={{ ...stickyTheadStyle, padding: '8px 14px', fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #e2e0da', color: '#22262b' }}>Diferencia (Libro − RG)</th>
                  )}
                  {!diffColOcultas.has('diferencia') && (
                    <th rowSpan={2} style={{ ...stickyTheadStyle, padding: '10px 14px', fontWeight: 600, verticalAlign: 'bottom', borderLeft: '2px solid #e2e0da' }}>
                      {(() => {
                        const col = DIFF_COLUMNAS.find(c => c.key === 'diferencia')!;
                        return (
                          <ExcelFilterHeader
                            label={col.label}
                            allValues={diffsAllValuesPorColumna[col.key]}
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
                    <th key={col.key} style={{ ...stickyTheadStyle, top: DIFF_THEAD_ROW1_HEIGHT, padding: '8px 14px', fontWeight: 600, textAlign: 'right', ...(i === 0 ? { borderLeft: '2px solid #e2e0da' } : {}) }}>
                      <ExcelFilterHeader
                        label={col.label}
                        allValues={diffsAllValuesPorColumna[col.key]}
                        active={diffColFiltros[col.key] ?? null}
                        onChange={(next) => setDiffColFiltros(prev => ({ ...prev, [col.key]: next }))}
                        align="right"
                      />
                    </th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {diffPaddingTop > 0 && (
                  <tr><td colSpan={DIFF_COLSPAN_ESPACIADOR} style={{ height: diffPaddingTop, padding: 0, border: 'none' }} /></tr>
                )}
                {diffVirtualItems.map(vi => {
                  const d = filteredDiffs[vi.index];
                  return (
                  <tr key={vi.key} style={{ borderBottom: '1px solid #f0eee8' }}>
                    {!diffColOcultas.has('doc') && <td style={{ padding: '10px 14px', fontWeight: 600, color: '#22262b' }}>{d.doc}</td>}
                    {!diffColOcultas.has('tipo_doc') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{d.tipo_doc}</td>}
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
                  );
                })}
                {diffPaddingBottom > 0 && (
                  <tr><td colSpan={DIFF_COLSPAN_ESPACIADOR} style={{ height: diffPaddingBottom, padding: 0, border: 'none' }} /></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e0da', backgroundColor: '#fafbfa', fontWeight: 700, color: '#22262b' }}>
                  <td colSpan={['doc', 'tipo_doc', 'proveedor', 'local'].filter(k => !diffColOcultas.has(k)).length} style={{ padding: '10px 14px' }}>Total ({filteredDiffs.length.toLocaleString('es-PY')} filas)</td>
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
            </Modal>
          )}
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

      {/* Overlay bloqueante con barra de progreso mientras se lee/analiza el Excel del libro
          de compras (Paso 1, ver doConvertir) -- mismo mecanismo que doConvert en App.tsx
          (Ventas): nada de la grilla resultante queda visible detrás hasta que termina. */}
      {converting && libroProgress && (
        <ProgressModal
          message="Analizando archivo del Libro de Compras…"
          percent={libroProgress.percent}
          total={libroProgress.total}
        />
      )}
      {/* Si termina en error (ej. archivo con formato incorrecto), se muestra con el modal
          genérico de siempre (sin barra, ya no hay ningún avance que mostrar) -- convertError
          ya viene limpio a null apenas arranca un intento nuevo (ver doConvertir), así que
          solo queda en pie acá cuando la conversión ya terminó y falló. */}
      {!converting && convertError && (
        <ProcessingModal error={convertError} onClose={() => setConvertError(null)} />
      )}

      {/* Única pantalla de progreso para "Analizar y comparar" (Paso 2, ver doComparar) --
          leer/analizar la RG y compararla contra el libro corren como un solo proceso, con
          un solo mensaje y un solo porcentaje. Adjuntar el archivo no dispara nada (ver
          handleRgFileInput) -- mismo criterio ya aplicado a RG90View.tsx (Ventas). */}
      {comparing && rgCompareProgress && (
        <ProgressModal
          message="Analizando y comparando contra la RG…"
          percent={rgCompareProgress.percent}
          total={rgCompareProgress.total}
        />
      )}
      {!comparing && compareError && (
        <ProcessingModal error={compareError} onClose={() => setCompareError(null)} />
      )}
    </div>
  );
};
