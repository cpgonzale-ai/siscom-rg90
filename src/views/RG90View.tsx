import React, { useMemo, useRef, useState, useTransition } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { GitCompare, UploadCloud, X, Trash2, ArrowLeft, ArrowRight, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { WizardSteps } from '../components/WizardSteps';
import { ExcelFilterHeader } from '../components/ExcelFilterHeader';
import { Modal, primaryBtnStyle, secondaryBtnStyle, dangerBtnStyle, excelBtnStyle, navRowStyle, disabledBtnStyle, stickyTheadStyle, scrollableGridStyle } from '../components/Modal';
import { ColumnPicker } from '../components/ColumnPicker';
import { TablaSaltos } from '../components/TablaSaltos';
import { formatGs } from '../utils/format';
import { exportarTablaExcelApi, exportarDiffVentasExcelApi } from '../services/api';
import type { RG90DiffRow } from '../services/api';
import {
  RG90_DIFF_COLUMNAS, RG90_DIFF_COLUMNAS_PICKER, CAMPOS_DIFF_VENTAS,
  valorCeldaDiffVentas, diferenciaCampoVentas, parseGs,
} from '../utils/diffVentasColumns';

// parseGs/valorCeldaDiffVentas/diferenciaCampoVentas/RG90_DIFF_COLUMNAS/_PICKER/CAMPOS_DIFF_VENTAS
// se movieron a utils/diffVentasColumns.ts para que diffExportWorker.ts (Web Worker del
// export a Excel) pueda usar la MISMA lógica de negocio sin duplicarla — ver
// auditoria/13-export-excel-wysiwyg.md.

// Mismas columnas/estilo que la grilla de resultado de Libro de Compras (Documento,
// Sistema/Local, desglose Libro/RG90 por tasa, Diferencia por tasa, Motivo).
// Alto real (medido) de la primera fila del encabezado de la grilla de resultado — mismo
// valor que ComprasView (idéntico padding/tamaño de fuente): la segunda fila necesita este
// valor como su propio `top` sticky para quedar pegada justo debajo de la primera.
const DIFF_THEAD_ROW1_HEIGHT = 41;

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
  // Total de comprobantes con estado "Anulada" en la comparación (ver resumen del
  // backend, /api/reconcile) — se muestra al lado de "Saltos" como indicador de solo
  // lectura, sin card ni filtro propio en rg90Cards.
  anuladasCount: number;
  // Cantidad total de comprobantes del Libro de Ventas propio (libroRows.length en
  // App.tsx, el mismo array que ya se manda como pos_data_json a /api/reconcile) — usado
  // solo para el Panel de Desglose Matemático, no participa de ningún cálculo de negocio.
  totalLibroCount: number;
  rg90Diff: any[];
  // Ya viene calculado desde App.tsx (ver el porqué en su propio comentario, junto a donde
  // se memoiza) — antes se calculaba ACÁ ADENTRO a partir de un rg90DiffAll crudo. El
  // problema no era la memoización en sí (estaba bien hecha, dependía solo de la fuente
  // sin filtrar) sino DÓNDE vivía: el caché de un useMemo es del componente, y App.tsx
  // desmonta y remonta RG90View cada vez que se sale del comparador (ej. volver a "Cargar
  // reportes") y se vuelve a entrar — perdiendo el caché aunque los datos no hubieran
  // cambiado un poco. Medido con un archivo de 100.000 filas: 27 segundos de bloqueo real
  // del navegador, recalculando desde cero las 21 columnas × todas las filas, solo por
  // haber salido y vuelto a entrar. Al vivir en App.tsx (que nunca se desmonta), este
  // cálculo sobrevive esos ciclos y solo se rehace cuando el diff real cambia de verdad.
  diffAllValuesPorColumna: Record<string, string[]>;
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
  anuladasCount,
  totalLibroCount,
  rg90Diff,
  diffAllValuesPorColumna,
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
  // Estado de "Generando Excel…" para los dos botones de export de esta vista (Paso 3 y
  // Paso 4) — ambos pueden llegar a 200.000 filas, y el backend tarda un rato real en armar
  // el archivo a ese volumen (~100s medido con 200.000 filas, ver
  // auditoria/13-export-excel-wysiwyg.md); sin este estado, un usuario impaciente podría
  // click-ear varias veces y disparar varios pedidos a la vez.
  const [exportandoRg90, setExportandoRg90] = useState(false);
  const [exportandoDiff, setExportandoDiff] = useState(false);

  // Visibilidad de columnas en pantalla (Paso 3, grilla "RG90 (SET) — Ventas") — igual que
  // en el Paso 2 (CargaView): no afecta descargarRg90Excel, que arma sus headers/dataRows a
  // mano desde rg90GridExportRows sin mirar este estado, así que el .xlsx siempre trae
  // todas las columnas. Ocultas por defecto: Gravadas 10%, IVA 10%, Gravadas 5%, IVA 5%,
  // Exentas.
  const [rg90GridColOcultas, setRg90GridColOcultas] = useState<Set<string>>(
    new Set(['gravadas', 'iva', 'gravadas_5', 'iva_5', 'exentas'])
  );
  const rg90GridColVisiblesKeys = new Set(rg90GridColumnFilters.filter(c => !rg90GridColOcultas.has(c.key)).map(c => c.key));
  const rg90GridLeadingColSpan = ['doc', 'tipo_doc', 'sistema', 'local', 'fecha', 'ruc', 'nombre']
    .filter(k => rg90GridColVisiblesKeys.has(k)).length;

  const descargarRg90Excel = async () => {
    if (rg90GridExportRows.length === 0 || exportandoRg90) return;
    const headers = ['Documento', 'Tipo', 'Sistema', 'Local', 'Fecha', 'RUC', 'Nombre', 'Gravadas 10%', 'IVA 10%', 'Gravadas 5%', 'IVA 5%', 'Exentas', 'Total', 'Estado'];
    // Importes con el mismo texto ya formateado de la grilla — no un number — para que el
    // Excel descargado coincida con la pantalla tal cual.
    const dataRows = rg90GridExportRows.map((r: any) => [
      r.doc, r.tipo_doc || 'Factura', r.sistema, r.local, r.fecha, r.ruc, r.nombre,
      r.gravadas, r.iva, r.gravadas_5 ?? '0,00', r.iva_5 ?? '0,00', r.exentas, r.total, r.estado,
    ]);
    setExportandoRg90(true);
    try {
      await exportarTablaExcelApi('RG90_Ventas.xlsx', 'RG90 (SET) — Ventas', headers, dataRows);
    } catch (e) {
      // Sin este catch, un fallo de red/timeout acá quedaba como una promesa rechazada sin
      // manejar: el botón se reactivaba igual (por el finally) pero sin ningún aviso — para
      // el usuario "no pasó nada", indistinguible de un cuelgue.
      console.error('Error al exportar RG90 a Excel:', e);
    } finally {
      setExportandoRg90(false);
    }
  };
  const [saltosRgModalOpen, setSaltosRgModalOpen] = useState(false);
  const [saltosTotalModalOpen, setSaltosTotalModalOpen] = useState(false);
  // Detalle de Discrepancias colapsado por defecto: al entrar al Paso 4 solo se ve el
  // resumen (desglose matemático + pestañas de totales), sin la grilla fila por fila. Se
  // abre al tocar cualquier pestaña de total (ver rg90Cards.map de abajo) o el botón de
  // desplegar del propio encabezado — la fila de encabezado (título, buscador, columnas,
  // Excel) queda siempre visible esté abierto o cerrado.
  const [detalleAbierto, setDetalleAbierto] = useState(false);
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
  // diffAllValuesPorColumna llega calculado como prop desde App.tsx (ver comentario en la
  // interfaz de props, arriba) — ya no se calcula acá.
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
      // Bug real corregido acá: esto restaba las sumas de libro/rg90 ya calculadas arriba
      // (acc.libro - acc.rg), que para una Nota de Crédito arrastra el mismo problema de
      // signo que diferenciaCampoVentas ya tiene corregido por fila (el libro guarda el
      // monto en negativo, la RG90 también para las NC del SET) -- restar dos sumas con
      // signo daba un total con el signo invertido respecto de lo que mostraba cada fila
      // individual (ej. una fila mostrando "500,00" pero el total de 1 sola fila dando
      // "-500,00"). Se sujeta al mismo criterio que cada celda: sumar el mismo valor por
      // fila que ya se ve en la grilla (diferenciaCampoVentas, que usa diferencias_detalle
      // cuando está disponible), no volver a restar sumas agregadas.
      acc.dif[campo] = filteredRg90DiffCols.reduce((s, d) => s + parseGs(diferenciaCampoVentas(d, campo)), 0);
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

  // Excel de la grilla de resultado (Paso 4) — WYSIWYG con lo que se ve en pantalla:
  // - Filas: solo las que quedan tras los filtros de columna + categoría + búsqueda
  //   (filteredRg90DiffCols ya viene con todo eso aplicado, ver App.tsx/filteredRg90Diff y
  //   el filtro por columna de acá arriba).
  // - Columnas: antes se exportaban TODAS (RG90_DIFF_COLUMNAS/_PICKER completos), ignorando
  //   diffColOcultas -- una columna que el usuario ocultó en la grilla igual aparecía en el
  //   Excel. Se filtra acá por lo mismo que decide qué <td> se renderiza.
  // - Orden: esta grilla no tiene una columna "activa" para ordenar (no hay esa función en
  //   la UI, solo filtro por columna) -- no hay nada que respetar ahí.
  //
  // Se arma en el BACKEND (exportarDiffVentasExcelApi), no en el navegador -- ver
  // auditoria/13-export-excel-wysiwyg.md: se probó primero un Web Worker (mueve el trabajo
  // fuera del hilo principal, pero sigue corriendo en el navegador) y con 200.000 filas la
  // librería xlsx igual revienta con "JavaScript heap out of memory" (2GB+ de heap) — no es
  // un problema de que bloquee la interfaz, es que arma todo el .xlsx comprimido en memoria
  // de una sola vez. El backend usa openpyxl en modo streaming (write_only), que escribe
  // fila por fila sin mantener el sheet completo en memoria — medido: 200.000 filas, ~105s,
  // sin problemas de memoria. Se manda filteredRg90DiffCols CRUDO (sin mapear) + las keys de
  // columnas visibles; el cálculo por celda (mismo criterio que RG90_DIFF_COLUMNAS acá
  // arriba) se repite del lado del servidor (ver app/api/export.py).
  const columnasVisiblesKeys = RG90_DIFF_COLUMNAS_PICKER.filter(c => !diffColOcultas.has(c.key)).map(c => c.key);
  const descargarDiffVentasExcel = async () => {
    if (filteredRg90DiffCols.length === 0 || exportandoDiff) return;
    setExportandoDiff(true);
    try {
      await exportarDiffVentasExcelApi(filteredRg90DiffCols as RG90DiffRow[], columnasVisiblesKeys);
    } catch (e) {
      console.error('Error al exportar el detalle de discrepancias a Excel:', e);
    } finally {
      setExportandoDiff(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 Step Wizard Progress Bar */}
      <WizardSteps steps={wizardSteps} />

      {/* Se mantiene siempre montado (mismo criterio que el bloque del Paso 4, más abajo,
          y por el mismo motivo que ahí se explica) -- antes era un `&&` condicional: al
          desmontar y remontar, la grilla de la RG90 (SET) de este paso perdía la
          memoización interna de ExcelFilterHeader (el Set + sort de valores únicos por
          columna, en sus 14 columnas) aunque los `allValues` que recibe como prop nunca
          hubieran cambiado -- medido con un archivo de 100.000 filas: 3-4 segundos de
          bloqueo real cada vez que se volvía a este paso desde Resultados, sin tocar
          ningún filtro. Con display:none esa memoización sobrevive la navegación. */}
      <div style={{ display: pasoMostrado === 3 ? 'flex' : 'none', flexDirection: 'column', gap: '20px' }}>
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
                <ColumnPicker columnas={rg90GridColumnFilters} ocultas={rg90GridColOcultas} onChange={setRg90GridColOcultas} />
                {hayRg90GridColFiltrosActivos && (
                  <button onClick={limpiarRg90GridColFiltros} style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}>
                    Limpiar filtros
                  </button>
                )}
                <button
                  onClick={descargarRg90Excel}
                  disabled={exportandoRg90}
                  style={{ ...excelBtnStyle, padding: '7px 12px', fontSize: '12px', ...(exportandoRg90 ? { opacity: 0.7, cursor: 'wait' } : {}) }}
                >
                  {exportandoRg90 ? 'Generando Excel…' : 'Excel'}
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
                    {rg90GridColumnFilters.filter(col => !rg90GridColOcultas.has(col.key)).map(col => {
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
                      {!rg90GridColOcultas.has('doc') && <td style={{ padding: '12px 14px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>}
                      {!rg90GridColOcultas.has('tipo_doc') && (
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
                      )}
                      {!rg90GridColOcultas.has('sistema') && <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.sistema}</td>}
                      {!rg90GridColOcultas.has('local') && <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.local}</td>}
                      {!rg90GridColOcultas.has('fecha') && <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.fecha}</td>}
                      {!rg90GridColOcultas.has('ruc') && <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.ruc}</td>}
                      {!rg90GridColOcultas.has('nombre') && <td style={{ padding: '12px 14px', color: '#22262b', fontWeight: 500 }}>{r.nombre}</td>}
                      {!rg90GridColOcultas.has('gravadas') && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas}</td>}
                      {!rg90GridColOcultas.has('iva') && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva}</td>}
                      {!rg90GridColOcultas.has('gravadas_5') && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas_5 ?? '0'}</td>}
                      {!rg90GridColOcultas.has('iva_5') && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva_5 ?? '0'}</td>}
                      {!rg90GridColOcultas.has('exentas') && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.exentas}</td>}
                      {!rg90GridColOcultas.has('total') && <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#22262b' }}>{r.total}</td>}
                      {!rg90GridColOcultas.has('estado') && (
                        <td style={{ padding: '12px 14px' }}>
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
                    <td colSpan={rg90GridLeadingColSpan} style={{ padding: '12px 14px' }}>Total ({rg90GridFilteredCount.toLocaleString('es-PY')} filas)</td>
                    {!rg90GridColOcultas.has('gravadas') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.gravadas)}</td>}
                    {!rg90GridColOcultas.has('iva') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.iva)}</td>}
                    {!rg90GridColOcultas.has('gravadas_5') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.gravadas_5)}</td>}
                    {!rg90GridColOcultas.has('iva_5') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.iva_5)}</td>}
                    {!rg90GridColOcultas.has('exentas') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.exentas)}</td>}
                    {!rg90GridColOcultas.has('total') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(rg90GridTotales.total)}</td>}
                    {!rg90GridColOcultas.has('estado') && <td />}
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
      </div>

      {/* Se mantiene siempre montado (mismo criterio que el bloque del Paso 3, arriba) y se
          oculta con display:none
          en vez de un && condicional -- medido en /auditoria/08-analisis-memoria-lag-global-200k.md:
          con 200.000 filas, desmontar y volver a montar este bloque le hace perder a
          diffAllValuesPorColumna/filteredRg90DiffCols/diffTotalesVentas toda su memoización
          (una instancia de componente nueva no tiene el cache de la anterior), costando ~21s
          solo por navegar Paso 4 -> Paso 3 -> Paso 4 sin tocar ningún filtro. Con
          display:none el DOM y los hooks de virtualización/memoización sobreviven la
          navegación intactos. */}
      <div style={{ display: pasoMostrado === 4 ? 'flex' : 'none', flexDirection: 'column', gap: '20px' }}>
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

        {/* Panel de Desglose Matemático: no agrega ningún cálculo nuevo — solo reordena en
            dos columnas (Libro propio / RG90) los mismos contadores que ya se ven arriba en
            rg90Cards + anuladasCount, para mostrar cómo se compone cada total. Los valores
            de rg90Cards vienen como string ya formados (ver rg90CardsState en App.tsx). */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {(() => {
            const porClave = (clave: string) => Number(rg90Cards.find((c: any) => c.key === clave)?.value ?? 0);
            const coinciden = porClave('Coincide');
            const diferenciaMonto = porClave('Diferencia de monto');
            const noEnRg90 = porClave('No llegó a la interfaz');
            const noEnLibro = porClave('No en libro propio');
            const anulados = rg90Loaded ? anuladasCount : 0;
            const sumaLibro = coinciden + diferenciaMonto + noEnRg90 + anulados;
            const sumaRg90 = coinciden + diferenciaMonto + noEnLibro;

            const filaStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', color: '#5c6470' };
            const tarjetaStyle: React.CSSProperties = { backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' };
            const cabeceraStyle: React.CSSProperties = { backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', padding: '14px 20px' };

            return (
              <>
                <div style={tarjetaStyle}>
                  <div style={{ ...cabeceraStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#22262b' }}>TU LIBRO DE VENTAS</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#22262b' }}>
                      Total de comprobantes: {rg90Loaded ? totalLibroCount.toLocaleString('es-PY') : '—'}
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '12.5px', color: '#9aa1ab', marginBottom: '4px' }}>Este total se compone de:</div>
                    <div style={filaStyle}><span>Coinciden</span><span>{coinciden.toLocaleString('es-PY')}</span></div>
                    <div style={filaStyle}><span>Diferencia de monto</span><span>{diferenciaMonto.toLocaleString('es-PY')}</span></div>
                    <div style={filaStyle}><span>No en RG90</span><span>{noEnRg90.toLocaleString('es-PY')}</span></div>
                    <div style={filaStyle}><span>Anulados</span><span>{anulados.toLocaleString('es-PY')}</span></div>
                    <div style={{ ...filaStyle, borderTop: '1px solid #e2e0da', marginTop: '4px', paddingTop: '10px', fontWeight: 700, color: '#22262b' }}>
                      <span>Total</span><span>{sumaLibro.toLocaleString('es-PY')}</span>
                    </div>
                  </div>
                </div>

                <div style={tarjetaStyle}>
                  <div style={{ ...cabeceraStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#22262b' }}>ARCHIVO RG90 (SET)</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#22262b' }}>
                      Total de comprobantes: {rg90Loaded ? rg90GridTotalCount.toLocaleString('es-PY') : '—'}
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '12.5px', color: '#9aa1ab', marginBottom: '4px' }}>Este total se compone de:</div>
                    <div style={filaStyle}><span>Coinciden</span><span>{coinciden.toLocaleString('es-PY')}</span></div>
                    <div style={filaStyle}><span>Diferencia de monto</span><span>{diferenciaMonto.toLocaleString('es-PY')}</span></div>
                    <div style={filaStyle}><span>No en libro de ventas</span><span>{noEnLibro.toLocaleString('es-PY')}</span></div>
                    <div style={{ ...filaStyle, borderTop: '1px solid #e2e0da', marginTop: '4px', paddingTop: '10px', fontWeight: 700, color: '#22262b' }}>
                      <span>Total</span><span>{sumaRg90.toLocaleString('es-PY')}</span>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Discrepancies Table */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
          {/* Antes eran 6 cards grandes y sueltas arriba de todo (título 24px, cada una su
              propia caja con borde/sombra). Ahora son pestañas chicas pegadas al borde
              superior de esta misma grilla — mismo onClick/isActive que ya traía cada
              rg90Cards (nada de lógica de filtro nueva), solo mucho más compactas y ancladas
              visualmente a lo que filtran, en vez de flotar separadas del título de arriba. */}
          <div style={{ display: 'flex', alignItems: 'stretch', backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', overflowX: 'auto' }}>
            {rg90Cards.map((c: any, idx: number) => (
              <button
                key={idx}
                onClick={() => { c.onClick(); setDetalleAbierto(true); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                  padding: '9px 16px', border: 'none', borderRight: '1px solid #e2e0da',
                  borderBottom: `2px solid ${c.isActive ? '#128752' : 'transparent'}`,
                  backgroundColor: c.isActive ? '#ffffff' : 'transparent',
                  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#9aa1ab', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{c.label}</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: c.isActive ? '#128752' : c.color }}>
                  {/* c.value es el número crudo en string (ver el comentario de rg90CardsState
                      en App.tsx) -- se formatea acá recién, solo para mostrarlo. */}
                  {rg90Loaded ? Number(c.value).toLocaleString('es-PY') : '—'}
                </span>
              </button>
            ))}
            <button
              onClick={() => setSaltosTotalModalOpen(true)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                padding: '9px 16px', border: 'none', borderRight: '1px solid #e2e0da',
                borderBottom: '2px solid transparent', backgroundColor: 'transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#9aa1ab', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Saltos</span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#b0740f' }}>{saltosTotales.length.toLocaleString('es-PY')}</span>
            </button>
            {/* Solo lectura: sin onClick ni cursor de mano, a diferencia de las pestañas de
                arriba — ver anuladasCount / summary.anuladas del backend. */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: '9px 16px', cursor: 'default', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#9aa1ab', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Anulados</span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#5c6470' }}>{rg90Loaded ? anuladasCount.toLocaleString('es-PY') : '—'}</span>
            </div>
          </div>

          {/* Ya no se expande in-line (había demasiada información junta en la pantalla al
              abrirla ahí mismo) — ahora esta barra es solo el resumen, y el detalle
              (buscador, columnas, Excel y la grilla) vive en el Modal de más abajo. Se abre
              tocando cualquier pestaña de arriba (ver rg90Cards.map, ya llama a
              setDetalleAbierto(true)) o directamente esta barra. */}
          <div
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fafbfa',
              cursor: 'pointer',
            }}
            onClick={() => setDetalleAbierto(true)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ChevronDown size={16} color="#5c6470" />
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>
                Detalle de Discrepancias e Inconsistencias ({filteredRg90DiffCols.length.toLocaleString('es-PY')} de {rg90Diff.length.toLocaleString('es-PY')})
              </h4>
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
                  <X size={12} style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); clearRg90Category(); }} />
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={e => { e.stopPropagation(); descargarDiffVentasExcel(); }}
                disabled={filteredRg90DiffCols.length === 0 || exportandoDiff}
                style={{ ...excelBtnStyle, padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', ...(exportandoDiff ? { opacity: 0.7, cursor: 'wait' } : {}) }}
              >
                <FileSpreadsheet size={14} color="#fff" />
                <span>{exportandoDiff ? 'Generando Excel…' : 'Excel'}</span>
              </button>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#128752' }}>Ver detalle</span>
            </div>
          </div>
        </div>
      </div>

      {detalleAbierto && (
        <Modal title="Detalle" onClose={() => setDetalleAbierto(false)} width="1400px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12.5px', color: '#5c6470' }}>
                {filteredRg90DiffCols.length.toLocaleString('es-PY')} de {rg90Diff.length.toLocaleString('es-PY')}
              </span>
              {isFiltrando && (
                <span style={{ fontSize: '11px', color: '#9aa1ab', fontStyle: 'italic' }}>Filtrando…</span>
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
                disabled={filteredRg90DiffCols.length === 0 || exportandoDiff}
                style={{ ...excelBtnStyle, padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', ...(exportandoDiff ? { opacity: 0.7, cursor: 'wait' } : {}) }}
              >
                <FileSpreadsheet size={14} color="#fff" />
                <span>{exportandoDiff ? 'Generando Excel…' : 'Excel'}</span>
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

          <div style={{ ...scrollableGridStyle, border: '1px solid #e2e0da', borderRadius: '8px', maxHeight: '60vh' }} ref={diffScrollRef}>
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
        </Modal>
      )}

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
