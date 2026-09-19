import React, { useMemo, useRef, useState, useTransition } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { GitCompare, UploadCloud, X, Trash2, ArrowLeft, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { WizardSteps } from '../components/WizardSteps';
import { ExcelFilterHeader } from '../components/ExcelFilterHeader';
import { Modal, primaryBtnStyle, secondaryBtnStyle, dangerBtnStyle, navRowStyle, disabledBtnStyle, stickyTheadStyle, scrollableGridStyle } from '../components/Modal';
import { ColumnPicker } from '../components/ColumnPicker';
import { TablaSaltos } from '../components/TablaSaltos';
import { formatGs } from '../utils/format';
import { downloadExcel } from '../utils/exportExcel';
import type { RG90DiffRow, RG90DiffLado } from '../services/api';

// Suma de importes formateados como los devuelve el backend ("18.891.429,00") — se
// necesita volver a número para poder sumar/restar entre filas antes de re-formatear.
const parseGs = (s: string): number => {
  const n = parseFloat(String(s ?? '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

// Mismo criterio que en Compras: si la fila es "Diferencia de monto", el campo que no está
// en diferencias_detalle (no difiere) se muestra en 0 — solo quedan visibles los importes
// que realmente causan la diferencia.
const valorCeldaDiffVentas = (d: RG90DiffRow, lado: 'libro' | 'rg90', campo: keyof RG90DiffLado): string => {
  const valor = d[lado][campo];
  if (d.diferencia !== 'Diferencia de monto' || valor === '—') return valor;
  return d.diferencias_detalle && campo in d.diferencias_detalle ? valor : '0,00';
};

const diferenciaCampoVentas = (d: RG90DiffRow, campo: keyof RG90DiffLado): string =>
  formatGs(parseGs(valorCeldaDiffVentas(d, 'libro', campo)) - parseGs(valorCeldaDiffVentas(d, 'rg90', campo)));

const CAMPOS_DIFF_VENTAS: (keyof RG90DiffLado)[] = ['gravada_10', 'gravada_5', 'iva_10', 'iva_5', 'exenta', 'total'];

// Mismas columnas/estilo que la grilla de resultado de Libro de Compras (Documento,
// Sistema/Local, desglose Libro/RG90 por tasa, Diferencia por tasa, Motivo).
// Alto real (medido) de la primera fila del encabezado de la grilla de resultado — mismo
// valor que ComprasView (idéntico padding/tamaño de fuente): la segunda fila necesita este
// valor como su propio `top` sticky para quedar pegada justo debajo de la primera.
const DIFF_THEAD_ROW1_HEIGHT = 41;

const RG90_DIFF_COLUMNAS: { key: string; label: string; getValue: (d: RG90DiffRow) => string }[] = [
  { key: 'doc', label: 'Documento', getValue: d => d.doc },
  { key: 'tipo_doc', label: 'Tipo', getValue: d => d.tipo_doc },
  { key: 'sistema', label: 'Sistema', getValue: d => d.sistema },
  { key: 'local', label: 'Local', getValue: d => d.local },
  { key: 'libro_gravada_10', label: 'Gravada 10%', getValue: d => valorCeldaDiffVentas(d, 'libro', 'gravada_10') },
  { key: 'libro_gravada_5', label: 'Gravada 5%', getValue: d => valorCeldaDiffVentas(d, 'libro', 'gravada_5') },
  { key: 'libro_iva_10', label: 'IVA 10%', getValue: d => valorCeldaDiffVentas(d, 'libro', 'iva_10') },
  { key: 'libro_iva_5', label: 'IVA 5%', getValue: d => valorCeldaDiffVentas(d, 'libro', 'iva_5') },
  { key: 'libro_exenta', label: 'Exenta', getValue: d => valorCeldaDiffVentas(d, 'libro', 'exenta') },
  { key: 'libro_total', label: 'Total', getValue: d => valorCeldaDiffVentas(d, 'libro', 'total') },
  { key: 'rg_gravada_10', label: 'Gravada 10%', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'gravada_10') },
  { key: 'rg_gravada_5', label: 'Gravada 5%', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'gravada_5') },
  { key: 'rg_iva_10', label: 'IVA 10%', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'iva_10') },
  { key: 'rg_iva_5', label: 'IVA 5%', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'iva_5') },
  { key: 'rg_exenta', label: 'Exenta', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'exenta') },
  { key: 'rg_total', label: 'Total', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'total') },
  { key: 'dif_gravada_10', label: 'Gravada 10%', getValue: d => diferenciaCampoVentas(d, 'gravada_10') },
  { key: 'dif_gravada_5', label: 'Gravada 5%', getValue: d => diferenciaCampoVentas(d, 'gravada_5') },
  { key: 'dif_iva_10', label: 'IVA 10%', getValue: d => diferenciaCampoVentas(d, 'iva_10') },
  { key: 'dif_iva_5', label: 'IVA 5%', getValue: d => diferenciaCampoVentas(d, 'iva_5') },
  { key: 'dif_exenta', label: 'Exenta', getValue: d => diferenciaCampoVentas(d, 'exenta') },
  { key: 'dif_total', label: 'Total', getValue: d => diferenciaCampoVentas(d, 'total') },
  { key: 'diferencia', label: 'Diferencia / Diagnóstico', getValue: d => d.diferencia },
];

const RG90_DIFF_COLUMNAS_PICKER: { key: string; label: string }[] = [
  { key: 'doc', label: 'Documento' },
  { key: 'tipo_doc', label: 'Tipo' },
  { key: 'sistema', label: 'Sistema' },
  { key: 'local', label: 'Local' },
  { key: 'libro_gravada_10', label: 'Libro — Gravada 10%' },
  { key: 'libro_gravada_5', label: 'Libro — Gravada 5%' },
  { key: 'libro_iva_10', label: 'Libro — IVA 10%' },
  { key: 'libro_iva_5', label: 'Libro — IVA 5%' },
  { key: 'libro_exenta', label: 'Libro — Exenta' },
  { key: 'libro_total', label: 'Libro — Total' },
  { key: 'rg_gravada_10', label: 'RG90 — Gravada 10%' },
  { key: 'rg_gravada_5', label: 'RG90 — Gravada 5%' },
  { key: 'rg_iva_10', label: 'RG90 — IVA 10%' },
  { key: 'rg_iva_5', label: 'RG90 — IVA 5%' },
  { key: 'rg_exenta', label: 'RG90 — Exenta' },
  { key: 'rg_total', label: 'RG90 — Total' },
  { key: 'dif_gravada_10', label: 'Diferencia — Gravada 10%' },
  { key: 'dif_gravada_5', label: 'Diferencia — Gravada 5%' },
  { key: 'dif_iva_10', label: 'Diferencia — IVA 10%' },
  { key: 'dif_iva_5', label: 'Diferencia — IVA 5%' },
  { key: 'dif_exenta', label: 'Diferencia — Exenta' },
  { key: 'dif_total', label: 'Diferencia — Total' },
  { key: 'diferencia', label: 'Diferencia / Diagnóstico' },
];

interface RG90ViewProps {
  wizardSteps: any[];
  // Paso 3 (Adjuntar RG90 y listar) vs Paso 4 (Resultado) — antes era un único paso; se
  // separó para que el Paso 3 se comporte como el Paso 2 de Compras (adjuntar + listar) y
  // el Paso 4 quede solo para el resultado, como el Paso 3 de Compras.
  pasoMostrado: 3 | 4;
  onVolverCarga: () => void;
  onSiguienteResultado: () => void;
  onVolverPaso3: () => void;
  rg90Loaded: boolean;
  rg90Attached: boolean;
  rg90StatusText: string;
  rg90FileLabel: string;
  rg90FileNames: string[];
  rg90DropzoneStyle: string;
  rg90AnalyzeBtnStyle: string;
  rg90Analyzing: boolean;
  rg90Error: string | null;
  canComparar: boolean;
  canQuitarArchivo: boolean;
  simulateRg90: () => void;
  onRg90FileUpload: (files: FileList) => void;
  onQuitarRg90Archivo: (index: number) => void;
  analyzeRg90: () => void;
  resetRg90: () => void;
  rg90Cards: any[];
  rg90Diff: any[];
  // Fuente SIN filtrar por búsqueda/categoría, para los desplegables de filtro tipo Excel
  // del encabezado (diffAllValuesPorColumna) — ver /auditoria/08-analisis-memoria-lag-global-200k.md:
  // antes esos desplegables se recalculaban sobre rg90Diff (que SÍ cambia de referencia en
  // cada tecla del buscador), 4,2 millones de llamadas a getValue por tecla. rg90DiffAll
  // solo cambia cuando se carga o recompara un lote de verdad.
  rg90DiffAll: any[];
  rg90Search: string;
  onRg90Search: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearRg90Search: () => void;
  rg90CategoryFilter: string;
  clearRg90Category: () => void;
  // Grilla del Paso 3 (registros de la RG90 tal como se parsearon)
  rg90GridRows: any[];
  // Filtrada por columna/búsqueda igual que rg90GridRows (ver App.tsx/filteredRg90Rows),
  // sin paginar — es la base del Excel descargado: "lo que se ve en la grilla" cuando hay
  // un filtro activo, o todo cuando no lo hay.
  rg90GridExportRows: any[];
  rg90GridTotalCount: number;
  rg90GridFilteredCount: number;
  rg90GridColumnFilters: { key: string; label: string; allValues: string[]; active: Set<string> | null; onChange: (next: Set<string> | null) => void }[];
  hayRg90GridColFiltrosActivos: boolean;
  limpiarRg90GridColFiltros: () => void;
  rg90GridTotales: { gravadas: number; iva: number; gravadas_5: number; iva_5: number; exentas: number; total: number };
  rg90GridSearch: string;
  onRg90GridSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rg90GridCurrentPage: number;
  rg90GridTotalPages: number;
  rg90GridPrevPage: () => void;
  rg90GridNextPage: () => void;
  // Saltos de numeración: los del libro propio (Paso 2, misma fuente que el modal de ahí)
  // y los detectados dentro de la RG90 misma (Paso 3, nuevo).
  saltosLibroRows: any[];
  saltosRgRows: any[];
}

export const RG90View: React.FC<RG90ViewProps> = ({
  wizardSteps,
  pasoMostrado,
  onVolverCarga,
  onSiguienteResultado,
  onVolverPaso3,
  rg90Loaded,
  rg90StatusText,
  rg90FileLabel,
  rg90FileNames,
  rg90DropzoneStyle,
  rg90AnalyzeBtnStyle,
  rg90Analyzing,
  rg90Error,
  canComparar,
  canQuitarArchivo,
  simulateRg90,
  onRg90FileUpload,
  onQuitarRg90Archivo,
  analyzeRg90,
  resetRg90,
  rg90Cards,
  rg90Diff,
  rg90DiffAll,
  rg90Search,
  onRg90Search,
  rg90CategoryFilter,
  clearRg90Category,
  rg90GridRows,
  rg90GridExportRows,
  rg90GridTotalCount,
  rg90GridFilteredCount,
  rg90GridColumnFilters,
  hayRg90GridColFiltrosActivos,
  limpiarRg90GridColFiltros,
  rg90GridTotales,
  rg90GridSearch,
  onRg90GridSearch,
  rg90GridCurrentPage,
  rg90GridTotalPages,
  rg90GridPrevPage,
  rg90GridNextPage,
  saltosLibroRows,
  saltosRgRows,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const descargarRg90Excel = () => {
    if (rg90GridExportRows.length === 0) return;
    const headers = ['Documento', 'Tipo', 'Sistema', 'Local', 'Fecha', 'RUC', 'Nombre', 'Gravadas 10%', 'IVA 10%', 'Gravadas 5%', 'IVA 5%', 'Exentas', 'Total', 'Estado'];
    // Importes con el mismo texto ya formateado de la grilla — no un number — para que el
    // Excel descargado coincida con la pantalla tal cual.
    const dataRows = rg90GridExportRows.map((r: any) => [
      r.doc, r.tipo_doc || 'Factura', r.sistema, r.local, r.fecha, r.ruc, r.nombre,
      r.gravadas, r.iva, r.gravadas_5 ?? '0,00', r.iva_5 ?? '0,00', r.exentas, r.total, r.estado,
    ]);
    downloadExcel('RG90_Ventas.xlsx', 'RG90 (SET) — Ventas', headers, dataRows);
  };
  const [saltosRgModalOpen, setSaltosRgModalOpen] = useState(false);
  const [saltosTotalModalOpen, setSaltosTotalModalOpen] = useState(false);
  const saltosTotales = [
    ...saltosLibroRows.map(r => ({ ...r, __origen: 'Libro venta' })),
    ...saltosRgRows.map(r => ({ ...r, __origen: 'RG90' })),
  ];

  // Grilla de resultado (Paso 4) — mismo patrón de filtro por columna + selector de
  // columnas que Libro de Compras (ComprasView), acá local a la vista porque el filtro de
  // texto general y el de categoría (las cards) ya se resuelven en App.tsx.
  const [diffColFiltros, setDiffColFiltrosRaw] = useState<Record<string, Set<string> | null>>({});
  // Medido con CPU profile real sobre 200.000 filas: aplicar un filtro bloquea el hilo
  // principal ~900ms (filteredRg90DiffCols + diffTotalesVentas recalculando sobre el
  // dataset completo). No se puede evitar ese trabajo — el usuario necesita ver el
  // resultado filtrado completo, no una aproximación — pero sí se puede evitar que la UI
  // se sienta trabada mientras tanto: envolver el setState en una transición (React 18) le
  // dice a React que esta actualización no es urgente, así puede seguir pintando
  // interacciones (cerrar el desplegable, hover, scroll) mientras el filtrado corre de
  // fondo, y exponer isFiltrando para mostrar una señal de carga en vez de una UI congelada
  // sin feedback.
  const [isFiltrando, startFiltroTransition] = useTransition();
  const setDiffColFiltros = (updater: Record<string, Set<string> | null> | ((prev: Record<string, Set<string> | null>) => Record<string, Set<string> | null>)) => {
    startFiltroTransition(() => setDiffColFiltrosRaw(updater));
  };
  // Por defecto se muestra el apartado "Diferencia" completo (IVA 10%/5%, Exenta, Total) —
  // solo quedan ocultas Gravada 10%/5%, igual que en Libro de Compras (ComprasView).
  const [diffColOcultas, setDiffColOcultas] = useState<Set<string>>(new Set(['dif_gravada_10', 'dif_gravada_5']));
  // Mismo patrón F1 (/auditoria/05-performance.md) — quedó pendiente cuando esta grilla era
  // F3 ("no tocar todavía"). allValues por columna para los desplegables de filtro del
  // encabezado, memoizado aparte, dependiendo de rg90DiffAll (la fuente SIN filtrar por
  // búsqueda/categoría — el desplegable tiene que ofrecer todos los valores posibles, no
  // solo los que quedan visibles con el filtro actual). RG90_DIFF_COLUMNAS es una constante
  // de módulo.
  //
  // Corregido en /auditoria/08-analisis-memoria-lag-global-200k.md: antes dependía de
  // rg90Diff (ya filtrado por búsqueda/categoría en App.tsx), que cambia de referencia en
  // cada tecla del buscador aunque el contenido no cambie — eso disparaba 4,2 millones de
  // llamadas a getValue (21 columnas × 200.000 filas) por tecla. rg90DiffAll solo cambia
  // cuando se carga o recompara un lote de verdad, no al tipear ni al tocar los cards de
  // categoría.
  const diffAllValuesPorColumna = useMemo(
    () => Object.fromEntries(RG90_DIFF_COLUMNAS.map(col => [col.key, rg90DiffAll.map(col.getValue)])),
    [rg90DiffAll]
  );
  // Memoizado con dependencia en rg90Diff/diffColFiltros (ambos estables: rg90Diff es una
  // prop que, después del hallazgo F4 de /auditoria/05-performance.md, viene de
  // filteredRg90Diff ya memoizado en App.tsx; diffColFiltros es un Record de estado propio
  // de este componente) — antes se recalculaba en cada render, sin importar si rg90Diff o
  // los filtros habían cambiado.
  const filteredRg90DiffCols = useMemo(() => {
    let lista = rg90Diff as RG90DiffRow[];
    for (const col of RG90_DIFF_COLUMNAS) {
      const activo = diffColFiltros[col.key];
      if (activo) lista = lista.filter(d => activo.has(col.getValue(d)));
    }
    return lista;
  }, [rg90Diff, diffColFiltros]);
  const hayDiffColFiltrosActivos = Object.values(diffColFiltros).some(v => v !== null && v !== undefined);
  // Hallazgo F4 (el más caro medido: 930 ms de JS puro con 107.000 diffs) — dependía de
  // filteredRg90DiffCols, que antes era un array nuevo en cada render (mismo problema de
  // referencia inestable que F1); memoizado arriba, este useMemo ahora sí evita recalcular
  // 12 pasadas de reduce() + parseGs() cuando nada relevante cambió.
  const diffTotalesVentas = useMemo(() => {
    const acc = { libro: {} as Record<string, number>, rg: {} as Record<string, number>, dif: {} as Record<string, number> };
    for (const campo of CAMPOS_DIFF_VENTAS) {
      acc.libro[campo] = filteredRg90DiffCols.reduce((s, d) => s + parseGs(valorCeldaDiffVentas(d, 'libro', campo)), 0);
      acc.rg[campo] = filteredRg90DiffCols.reduce((s, d) => s + parseGs(valorCeldaDiffVentas(d, 'rg90', campo)), 0);
      acc.dif[campo] = acc.libro[campo] - acc.rg[campo];
    }
    return acc;
  }, [filteredRg90DiffCols]);
  // Memoizadas por diffColOcultas: DiffRow (más abajo) está envuelta en React.memo para no
  // recalcular col.getValue/parseInlineStyle de cada fila visible en cada re-render que
  // dispara el virtualizador durante el scroll (medido con CPU profile + trace real sobre
  // 200.000 filas: sin esto, estos 3 arrays eran objetos nuevos en cada render y React.memo
  // nunca hubiera podido saltarse el recálculo de ninguna fila, con o sin scroll de por
  // medio).
  const diffLibroColsVisibles = useMemo(
    () => RG90_DIFF_COLUMNAS.filter(c => c.key.startsWith('libro_') && !diffColOcultas.has(c.key)),
    [diffColOcultas]
  );
  const diffRgColsVisibles = useMemo(
    () => RG90_DIFF_COLUMNAS.filter(c => c.key.startsWith('rg_') && !diffColOcultas.has(c.key)),
    [diffColOcultas]
  );
  const diffDifColsVisibles = useMemo(
    () => RG90_DIFF_COLUMNAS.filter(c => c.key.startsWith('dif_') && !diffColOcultas.has(c.key)),
    [diffColOcultas]
  );

  // Virtualización de la grilla de Discrepancias (hallazgo F3 de /auditoria/05-performance.md
  // y 07-performance-analisis-post-limpieza.md — cuello de botella real, confirmado con CPU
  // profile real y curva de escala: a 25.000 filas el navegador llegaba a crashear).
  // Objetivo: soportar 200.000 filas sin insertar esa cantidad de nodos <tr> reales al DOM.
  //
  // Se usa la técnica de "filas espaciadoras" (padding-top/padding-bottom en vez de
  // position:absolute) porque los hijos de <tbody> no respetan position:absolute de forma
  // confiable en todos los navegadores — con filas <tr> espaciadoras el layout de la
  // <table> real (incluido el <thead> sticky de dos filas y el <tfoot> con los totales) no
  // se toca para nada, solo cambia qué filas de datos están montadas en un momento dado.
  //
  // col.getValue(r) para las columnas de Libro/RG90/Diferencia sigue llamándose una vez por
  // celda igual que antes — lo que cambia es que ahora "r" recorre únicamente
  // diffVirtualItems (las filas visibles + el colchón de overscan), no las 200.000 filas de
  // filteredRg90DiffCols completo. Los totales (diffTotalesVentas, arriba) y el Excel
  // (descargarDiffVentasExcel, abajo) siguen usando filteredRg90DiffCols completo sin
  // cambios — necesitan las filas filtradas enteras, no solo las visibles en pantalla.
  const diffScrollRef = useRef<HTMLDivElement>(null);
  const diffRowVirtualizer = useVirtualizer({
    count: filteredRg90DiffCols.length,
    getScrollElement: () => diffScrollRef.current,
    // 93px medido en el navegador real (getBoundingClientRect().height de un <tr> real de
    // esta grilla — DIFF_THEAD_ROW1_HEIGHT, 41px, es el alto de una fila del ENCABEZADO, no
    // de una fila de datos; usarlo acá daba un desfasaje real: con la estimación en 41px, el
    // scroll nunca llegaba a montar la última fila aunque el usuario llegara al final físico
    // del scroll — confirmado con Playwright antes de este ajuste).
    //
    // Altura fija, SIN measureElement: todas las celdas de esta fila son de una sola línea
    // (documento, importes, chip de diagnóstico corto — nada envuelve a dos líneas), así que
    // no hace falta remedir cada fila con un ResizeObserver. Confirmado con un trace real de
    // Chrome durante scroll continuo sobre 200.000 filas: con measureElement puesto,
    // Document::UpdateStyleAndLayout se disparaba 1.391 veces en ~4s de scroll (el patrón de
    // "forced reflow" típico de leer getBoundingClientRect en cada fila que se monta/desmonta
    // por el ResizeObserver interno). Sacando el ref, ese layout forzado desaparece — sin
    // ninguna fila real que pierda su alto, porque 93px ya es exacto, no una estimación.
    estimateSize: () => 93,
    overscan: 15,
  });
  const diffVirtualItems = diffRowVirtualizer.getVirtualItems();
  const diffPaddingTop = diffVirtualItems.length > 0 ? diffVirtualItems[0].start : 0;
  const diffPaddingBottom = diffVirtualItems.length > 0
    ? diffRowVirtualizer.getTotalSize() - diffVirtualItems[diffVirtualItems.length - 1].end
    : 0;
  // colSpan holgado para las filas espaciadoras — HTML tolera un colSpan mayor a la
  // cantidad real de columnas sin ningún efecto visual, no hace falta calcularlo exacto
  // según diffColOcultas.
  const DIFF_COLSPAN_ESPACIADOR = 30;

  // Excel de la grilla de resultado (Paso 4) — mismos labels del selector de columnas
  // (más descriptivos que los de la cabecera agrupada) y solo las filas que quedan tras
  // los filtros de columna + categoría + búsqueda (filteredRg90DiffCols ya viene con todo
  // eso aplicado, ver App.tsx/filteredRg90Diff y el filtro por columna de acá arriba).
  const descargarDiffVentasExcel = () => {
    if (filteredRg90DiffCols.length === 0) return;
    const headers = RG90_DIFF_COLUMNAS_PICKER.map(c => c.label);
    const dataRows = filteredRg90DiffCols.map(d =>
      RG90_DIFF_COLUMNAS.map(col => col.getValue(d))
    );
    downloadExcel('Resultado_Comparacion_Ventas_RG90.xlsx', 'Resultado — Ventas vs RG90', headers, dataRows);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 Step Wizard Progress Bar */}
      <WizardSteps steps={wizardSteps} />

      {pasoMostrado === 3 && (
        <>
        <div style={navRowStyle}>
          <button onClick={onVolverCarga} style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={16} />
            <span>Volver</span>
          </button>
          <button
            onClick={onSiguienteResultado}
            disabled={!rg90Loaded}
            style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px', ...(!rg90Loaded ? disabledBtnStyle : {}) }}
          >
            <span>Siguiente: Ver resultado</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Upload RG90 Section */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e0da',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitCompare size={20} color="#128752" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>
                  3. Adjuntar el archivo de la RG90 (SET)
                </h3>
              </div>
              {rg90StatusText && (
                <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
                  {rg90StatusText}
                </p>
              )}
            </div>

            {/* Misma posición y estilo en las 4 secciones de la app donde se adjuntan
                archivos (CargaView, acá, ComprasView Paso1 y Paso2): el botón que elimina
                todo lo adjuntado va en el header, junto al título. */}
            {rg90Loaded && canQuitarArchivo && (
              <button
                onClick={resetRg90}
                style={{ ...dangerBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={14} />
                <span>Eliminar todos</span>
              </button>
            )}
          </div>

          {/* Dropzone & Analyze Button */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={parseInlineStyle(rg90DropzoneStyle)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <UploadCloud size={18} color="#128752" />
                <span>{rg90FileLabel}</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xls,.xlsx"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  simulateRg90();
                  onRg90FileUpload(e.target.files);
                }
                e.target.value = '';
              }}
            />

            {canComparar && (
              <button onClick={analyzeRg90} disabled={rg90Analyzing} style={parseInlineStyle(rg90AnalyzeBtnStyle)}>
                {rg90Analyzing ? 'Comparando…' : 'Analizar y comparar'}
              </button>
            )}
          </div>

          {/* Lista de archivos adjuntados — la RG90 se descarga en reportes separados por
              tipo de comprobante (venta y nota de crédito, Minuta 3), así que puede hacer
              falta adjuntar más de uno antes de comparar; se consolidan todos en el
              backend (ver /api/reconcile). */}
          {rg90FileNames.length > 0 && (
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rg90FileNames.map((name, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', background: '#fafbfa', border: '1px solid #f0eee8', borderRadius: '7px', fontSize: '12.5px', color: '#22262b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileSpreadsheet size={14} color="#5c6470" />
                    <span>{name}</span>
                  </div>
                  <X size={14} style={{ cursor: 'pointer', color: '#9aa1ab' }} onClick={() => onQuitarRg90Archivo(i)} />
                </div>
              ))}
            </div>
          )}

          {rg90Error && (
            <div
              style={{
                marginTop: '14px',
                backgroundColor: '#fbe9e3',
                border: '1px solid #eec3b5',
                color: '#8a3a26',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12.5px',
              }}
            >
              {rg90Error}
            </div>
          )}
        </div>

        {/* Mismo lugar que el botón de saltos del Paso 2 (CargaView): una fila de
            controles propia, entre la card de carga y la grilla — no adentro del header de
            la grilla. Solo se muestra si se detectaron saltos DENTRO de la RG90 misma, a
            diferencia del botón del Paso 2, que siempre está visible. */}
        {saltosRgRows.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setSaltosRgModalOpen(true)}
              style={{
                background: '#ffffff', border: '1px solid #e2e0da', color: '#5c6470',
                borderRadius: '7px', padding: '8px 14px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Saltos ({saltosRgRows.length})
            </button>
          </div>
        )}

        {/* Grilla de la RG90 cargada — igual que la del libro propio en el paso 2, para
            poder consultar los registros de la RG90 por separado antes de ver el
            resultado en el Paso 4 */}
        {rg90GridTotalCount > 0 && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e0da', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafbfa', flexWrap: 'wrap', gap: '10px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>
                RG90 (SET) — Ventas ({rg90GridFilteredCount.toLocaleString('es-PY')} de {rg90GridTotalCount.toLocaleString('es-PY')} comprobantes)
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {hayRg90GridColFiltrosActivos && (
                  <button onClick={limpiarRg90GridColFiltros} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                    Limpiar filtros
                  </button>
                )}
                <button onClick={descargarRg90Excel} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                  Excel
                </button>
                <input
                  type="text" placeholder="Buscar..." value={rg90GridSearch}
                  onChange={onRg90GridSearch}
                  style={{ padding: '7px 12px', border: '1px solid #e2e0da', borderRadius: '6px', fontSize: '12px', width: '200px' }}
                />
              </div>
            </div>

            <div style={scrollableGridStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                    {rg90GridColumnFilters.map(col => {
                      const esImporte = ['gravadas', 'iva', 'gravadas_5', 'iva_5', 'exentas', 'total'].includes(col.key);
                      return (
                        <th key={col.key} style={{ ...stickyTheadStyle, backgroundColor: '#fafbfa', padding: '12px 14px', fontWeight: 600, textAlign: esImporte ? 'right' : 'left' }}>
                          <ExcelFilterHeader label={col.label} allValues={col.allValues} active={col.active} onChange={col.onChange} align={esImporte ? 'right' : 'left'} />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rg90GridRows.map((r: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            background: r.tipo_doc === 'Nota de Crédito' ? '#f1eef8' : '#eef2fb',
                            color: r.tipo_doc === 'Nota de Crédito' ? '#5b3aa8' : '#2f5fa8',
                            fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px',
                          }}
                        >
                          {r.tipo_doc || 'Factura'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.sistema}</td>
                      <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.local}</td>
                      <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.fecha}</td>
                      <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.ruc}</td>
                      <td style={{ padding: '12px 14px', color: '#22262b', fontWeight: 500 }}>{r.nombre}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas_5 ?? '0'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva_5 ?? '0'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.exentas}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#22262b' }}>{r.total}</td>
                      <td style={{ padding: '12px 14px' }}>
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
                    <td colSpan={7} style={{ padding: '12px 14px' }}>Total ({rg90GridFilteredCount.toLocaleString('es-PY')} filas)</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.gravadas)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.iva)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.gravadas_5)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.iva_5)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.exentas)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {rg90GridTotalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', borderTop: '1px solid #f0eee8' }}>
                <button disabled={rg90GridCurrentPage <= 1} onClick={rg90GridPrevPage} style={{ ...secondaryBtnStyle, opacity: rg90GridCurrentPage <= 1 ? 0.5 : 1 }}>Anterior</button>
                <span style={{ fontSize: '12.5px', color: '#5c6470' }}>Página {rg90GridCurrentPage} de {rg90GridTotalPages}</span>
                <button disabled={rg90GridCurrentPage >= rg90GridTotalPages} onClick={rg90GridNextPage} style={{ ...secondaryBtnStyle, opacity: rg90GridCurrentPage >= rg90GridTotalPages ? 0.5 : 1 }}>Siguiente</button>
              </div>
            )}
          </div>
        )}
        </>
      )}

      {/* Se mantiene siempre montado (a diferencia del Paso 3) y se oculta con display:none
          en vez de un && condicional -- medido en /auditoria/08-analisis-memoria-lag-global-200k.md:
          con 200.000 filas, desmontar y volver a montar este bloque le hace perder a
          diffAllValuesPorColumna/filteredRg90DiffCols/diffTotalesVentas toda su memoización
          (una instancia de componente nueva no tiene el cache de la anterior), costando ~21s
          solo por navegar Paso 4 -> Paso 3 -> Paso 4 sin tocar ningún filtro. Con
          display:none el DOM y los hooks de virtualización/memoización sobreviven la
          navegación intactos. */}
      <div style={{ display: pasoMostrado === 4 ? undefined : 'none' }}>
        <div style={navRowStyle}>
          <button onClick={onVolverPaso3} style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={16} />
            <span>Volver</span>
          </button>
          <span />
        </div>

        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitCompare size={20} color="#128752" />
          4. Resultado de la comparación
        </h3>

        {/* RG90 Summary Filter Cards — "Saltos" va como 4ª card, al costado derecho de
            "No en libro venta" (antes era un botón aparte, al lado del título). Total
            combinado: saltos del libro venta (Paso 2) + saltos dentro de la RG90 (Paso 3) —
            el modal distingue el origen de cada uno con una columna aparte. */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rg90Cards.length + 1}, 1fr)`, gap: '14px' }}>
          {rg90Cards.map((c: any, idx: number) => (
            <div
              key={idx}
              onClick={c.onClick}
              style={{
                backgroundColor: c.isActive ? '#e8f3ec' : '#ffffff',
                border: `1px solid ${c.isActive ? '#128752' : '#e2e0da'}`,
                borderRadius: '10px',
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: c.isActive ? '0 2px 8px rgba(18, 135, 82, 0.15)' : 'none',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>{c.label}</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: c.color, marginTop: '4px' }}>
                {rg90Loaded ? c.value : '—'}
              </div>
            </div>
          ))}
          <div
            onClick={() => setSaltosTotalModalOpen(true)}
            style={{
              backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px',
              padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>Saltos</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#b0740f', marginTop: '4px' }}>
              {saltosTotales.length}
            </div>
          </div>
        </div>

        {/* Discrepancies Table */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e0da',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fafbfa',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>
                Detalle de Discrepancias e Inconsistencias ({filteredRg90DiffCols.length.toLocaleString('es-PY')} de {rg90Diff.length.toLocaleString('es-PY')})
              </h4>
              {isFiltrando && (
                <span style={{ fontSize: '11px', color: '#9aa1ab', fontStyle: 'italic' }}>Filtrando…</span>
              )}
              {rg90CategoryFilter && (
                <span
                  style={{
                    backgroundColor: '#e8f3ec',
                    color: '#128752',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Filtro: {rg90CategoryFilter}
                  <X size={12} style={{ cursor: 'pointer' }} onClick={clearRg90Category} />
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {hayDiffColFiltrosActivos && (
                <button onClick={() => setDiffColFiltros({})} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                  Limpiar filtros
                </button>
              )}
              <ColumnPicker columnas={RG90_DIFF_COLUMNAS_PICKER} ocultas={diffColOcultas} onChange={setDiffColOcultas} />
              <button
                onClick={descargarDiffVentasExcel}
                disabled={filteredRg90DiffCols.length === 0}
                style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileSpreadsheet size={14} color="#5c6470" />
                <span>Excel</span>
              </button>
              <input
                type="text"
                placeholder="Buscar por doc, local..."
                value={rg90Search}
                onChange={onRg90Search}
                style={{
                  padding: '7px 12px',
                  border: '1px solid #e2e0da',
                  borderRadius: '6px',
                  fontSize: '12px',
                  width: '220px',
                }}
              />
            </div>
          </div>

          <div style={scrollableGridStyle} ref={diffScrollRef}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                {RG90_DIFF_COLUMNAS.filter(c => ['doc', 'tipo_doc', 'sistema', 'local'].includes(c.key) && !diffColOcultas.has(c.key)).map(col => (
                  <th key={col.key} rowSpan={2} style={{ ...stickyTheadStyle, padding: '10px 14px', fontWeight: 600, verticalAlign: 'bottom' }}>
                    <ExcelFilterHeader
                      label={col.label}
                      allValues={diffAllValuesPorColumna[col.key]}
                      active={diffColFiltros[col.key] ?? null}
                      onChange={(next) => setDiffColFiltros(prev => ({ ...prev, [col.key]: next }))}
                    />
                  </th>
                ))}
                {diffLibroColsVisibles.length > 0 && (
                  <th colSpan={diffLibroColsVisibles.length} style={{ ...stickyTheadStyle, padding: '8px 14px', fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #e2e0da', color: '#22262b' }}>Libro de Ventas</th>
                )}
                {diffRgColsVisibles.length > 0 && (
                  <th colSpan={diffRgColsVisibles.length} style={{ ...stickyTheadStyle, padding: '8px 14px', fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #e2e0da', color: '#22262b' }}>RG90 (SET)</th>
                )}
                {diffDifColsVisibles.length > 0 && (
                  <th colSpan={diffDifColsVisibles.length} style={{ ...stickyTheadStyle, padding: '8px 14px', fontWeight: 700, textAlign: 'center', borderLeft: '2px solid #e2e0da', color: '#22262b' }}>Diferencia (Libro − RG90)</th>
                )}
                {!diffColOcultas.has('diferencia') && (
                  <th rowSpan={2} style={{ ...stickyTheadStyle, padding: '10px 14px', fontWeight: 600, verticalAlign: 'bottom', borderLeft: '2px solid #e2e0da' }}>
                    {(() => {
                      const col = RG90_DIFF_COLUMNAS.find(c => c.key === 'diferencia')!;
                      return (
                        <ExcelFilterHeader
                          label={col.label}
                          allValues={diffAllValuesPorColumna[col.key]}
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
                      allValues={diffAllValuesPorColumna[col.key]}
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
              {diffVirtualItems.map(vi => (
                <DiffRow
                  key={vi.key}
                  index={vi.index}
                  r={filteredRg90DiffCols[vi.index] as any}
                  diffColOcultas={diffColOcultas}
                  diffLibroColsVisibles={diffLibroColsVisibles}
                  diffRgColsVisibles={diffRgColsVisibles}
                  diffDifColsVisibles={diffDifColsVisibles}
                />
              ))}
              {diffPaddingBottom > 0 && (
                <tr><td colSpan={DIFF_COLSPAN_ESPACIADOR} style={{ height: diffPaddingBottom, padding: 0, border: 'none' }} /></tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e2e0da', backgroundColor: '#fafbfa', fontWeight: 700, color: '#22262b' }}>
                <td colSpan={['doc', 'tipo_doc', 'sistema', 'local'].filter(k => !diffColOcultas.has(k)).length} style={{ padding: '10px 14px' }}>Total ({filteredRg90DiffCols.length.toLocaleString('es-PY')} filas)</td>
                {diffLibroColsVisibles.map((col, i) => (
                  <td key={col.key} style={{ padding: '10px 14px', textAlign: 'right', ...(i === 0 ? { borderLeft: '2px solid #e2e0da' } : {}) }}>
                    {formatGs(diffTotalesVentas.libro[col.key.replace('libro_', '')])}
                  </td>
                ))}
                {diffRgColsVisibles.map((col, i) => (
                  <td key={col.key} style={{ padding: '10px 14px', textAlign: 'right', ...(i === 0 ? { borderLeft: '2px solid #e2e0da' } : {}) }}>
                    {formatGs(diffTotalesVentas.rg[col.key.replace('rg_', '')])}
                  </td>
                ))}
                {diffDifColsVisibles.map((col, i) => (
                  <td key={col.key} style={{ padding: '10px 14px', textAlign: 'right', ...(i === 0 ? { borderLeft: '2px solid #e2e0da' } : {}) }}>
                    {formatGs(diffTotalesVentas.dif[col.key.replace('dif_', '')])}
                  </td>
                ))}
                {!diffColOcultas.has('diferencia') && <td style={{ padding: '10px 14px', borderLeft: '2px solid #e2e0da' }} />}
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      </div>

      {saltosRgModalOpen && (
        <Modal title={`Saltos de numeración dentro de la RG90 (${saltosRgRows.length})`} onClose={() => setSaltosRgModalOpen(false)} width="900px">
          <TablaSaltos rows={saltosRgRows} />
        </Modal>
      )}

      {saltosTotalModalOpen && (
        <Modal title={`Saltos de numeración — total (${saltosTotales.length})`} onClose={() => setSaltosTotalModalOpen(false)} width="960px">
          {saltosTotales.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#5c6470' }}>No se detectaron saltos de numeración, ni en el libro venta ni en la RG90.</p>
          ) : (
            <TablaSaltos rows={saltosTotales} conOrigen />
          )}
        </Modal>
      )}
    </div>
  );
};

function parseInlineStyle(styleStr: string): React.CSSProperties {
  const styles: React.CSSProperties = {};
  if (!styleStr) return styles;
  styleStr.split(';').forEach(rule => {
    const [key, val] = rule.split(':');
    if (key && val) {
      const camelKey = key.trim().replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      (styles as any)[camelKey] = val.trim();
    }
  });
  return styles;
}

// Fila de la grilla de Detalle de Discrepancias, envuelta en React.memo. Medido con CPU
// profile + trace de Chrome real sobre 200.000 filas: el virtualizador dispara un re-render
// de RG90View en cada frame de scroll (cambia qué índices están montados), y sin este memo
// las ~20-35 filas visibles + overscan recalculaban col.getValue (con su parseGs/formatGs
// vía Intl.NumberFormat) y parseInlineStyle en CADA uno de esos re-renders, incluso para
// filas cuyos datos no cambiaron entre un frame y el siguiente. Con React.memo, una fila
// solo se vuelve a calcular si su propia fila (r), las columnas visibles o diffColOcultas
// cambiaron — durante un scroll común, la enorme mayoría de las filas montadas siguen siendo
// las mismas de un frame al otro.
const DiffRow = React.memo(function DiffRow({ index, r, diffColOcultas, diffLibroColsVisibles, diffRgColsVisibles, diffDifColsVisibles }: {
  index: number;
  r: RG90DiffRow;
  diffColOcultas: Set<string>;
  diffLibroColsVisibles: typeof RG90_DIFF_COLUMNAS;
  diffRgColsVisibles: typeof RG90_DIFF_COLUMNAS;
  diffDifColsVisibles: typeof RG90_DIFF_COLUMNAS;
}) {
  return (
    <tr data-index={index} style={{ borderBottom: '1px solid #f0eee8' }}>
      {!diffColOcultas.has('doc') && <td style={{ padding: '10px 14px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>}
      {!diffColOcultas.has('tipo_doc') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.tipo_doc}</td>}
      {!diffColOcultas.has('sistema') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.sistema}</td>}
      {!diffColOcultas.has('local') && <td style={{ padding: '10px 14px', color: '#5c6470' }}>{r.local}</td>}
      {[diffLibroColsVisibles, diffRgColsVisibles, diffDifColsVisibles].flatMap(grupo => grupo.map((col, i) => (
        <td
          key={col.key}
          style={{
            padding: '10px 14px', textAlign: 'right', color: '#5c6470',
            ...(i === 0 ? { borderLeft: '2px solid #f0eee8' } : {}),
            ...(col.key.endsWith('_total') ? { fontWeight: 600, color: '#22262b' } : {}),
          }}
        >
          {col.getValue(r)}
        </td>
      )))}
      {!diffColOcultas.has('diferencia') && (
        <td style={{ padding: '10px 14px', borderLeft: '2px solid #f0eee8' }}>
          <span style={parseInlineStyle((r as any).diffChipStyle)}>{r.diferencia}</span>
        </td>
      )}
    </tr>
  );
});
