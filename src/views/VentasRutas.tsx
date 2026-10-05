import { totalFaltantes } from '../utils/saltos';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Screen } from '../App';
import { useVentas, SYSTEMS_META } from '../hooks/useVentas';
import type { VentasParams } from '../hooks/useVentas';
import { DashboardView } from './DashboardView';
import { CargaView } from './CargaView';
import { LibroCompletoView } from './LibroCompletoView';
import { CorrelatividadView } from './CorrelatividadView';
import { RG90View } from './RG90View';
import { ProgressModal } from '../components/ProgressModal';
import { ProcessingModal } from '../components/ProcessingModal';
import { ComprobantesDuplicadosModal } from '../components/ComprobantesDuplicadosModal';
import { cancelarOperacionEnCurso } from '../utils/progreso';

// Rutas de Ventas (Panel, Carga, Libro completo, Correlatividad y RG90). El estado vive en
// VentasProvider, que se monta alrededor de las rutas en App.tsx: un cambio de estado de
// Ventas (filtros, búsqueda, pasos) re-renderiza solo estas vistas, no App, la barra lateral
// ni el encabezado. El JSX de cada ruta es el mismo que tenía en App.tsx.

type VentasCtx = ReturnType<typeof useVentas> & {
  puede: (clave: string) => boolean;
  goTo: (next: Screen) => void;
  navigate: ReturnType<typeof useNavigate>;
  rg90PasoMostrado: 3 | 4;
  locales: VentasParams['locales'];
  rg90Busy: boolean;
};

const VentasContext = createContext<VentasCtx | null>(null);

export function VentasProvider({ params, puede, goTo, children }: {
  params: VentasParams;
  puede: (clave: string) => boolean;
  goTo: (next: Screen) => void;
  children: ReactNode;
}) {
  const ventas = useVentas(params);
  const value: VentasCtx = {
    ...ventas,
    puede,
    goTo,
    navigate: params.navigate,
    rg90PasoMostrado: params.rg90PasoMostrado,
    locales: params.locales,
    rg90Busy: ventas.rg90Progress !== null,
  };
  return <VentasContext.Provider value={value}>{children}</VentasContext.Provider>;
}

function useVentasCtx(): VentasCtx {
  const ctx = useContext(VentasContext);
  if (!ctx) throw new Error('useVentasCtx debe usarse dentro de VentasProvider');
  return ctx;
}

export function VentasPanelRoute() {
  const {
    converted, correlatividadRows, dashboardSteps, goTo, guidanceText, hasAnyUpload, importStatusComputed, isFreshStart, libroRows, nextCtaAction, nextCtaLabel, puede, rg90Loaded,
  } = useVentasCtx();
  return (
      <DashboardView
        steps={dashboardSteps}
        isFreshStart={isFreshStart}
        converted={converted}
        rg90Loaded={rg90Loaded}
        hasAnyUpload={hasAnyUpload}
        guidanceText={guidanceText}
        nextCtaLabel={nextCtaLabel}
        nextCtaAction={nextCtaAction}
        importStatus={importStatusComputed}
        kpiLocales={converted ? `${new Set(libroRows.map(r => r.local)).size}` : '0'}
        kpiComprobantes={converted ? `${libroRows.length}` : '0'}
        kpiSaltos={converted ? `${totalFaltantes(correlatividadRows)}` : '—'}
        onGoCargaVentas={() => goTo('carga')}
        onGoCargaCompras={() => goTo('compras')}
        canCargaVentas={puede('pantalla:carga')}
        canCargaCompras={puede('pantalla:compras')}
      />
  );
}

export function VentasCargaRoute() {
  const {
    cargaUploaderOpen, convertError, converted, converting, correlatividadRows, currentPage, deleteLibro, descargandoLimpio, doConvert, downloadLimpio, filteredLibro, filtro, handleFileUpload, hasAnyUpload, hayLibroColFiltrosActivos, libroColumnFilters, libroRows, libroTotales, limpiarLibroColFiltros, navigate, pageSize, pagedLibro, puede, removeAllFiles, searchGeneral, selectedSystemKey, setCargaUploaderOpen, setFiltro, setPage, setSearchGeneral, setSelectedSystemKey, setUploadedFiles, simulateUpload, totalPages, uploadedFiles, wizardSteps,
  } = useVentasCtx();
  return (
      <CargaView
        wizardSteps={wizardSteps}
        systemOptions={SYSTEMS_META}
        selectedSystemKey={selectedSystemKey}
        onSelectSystem={(e) => setSelectedSystemKey(e.target.value)}
        simulateUpload={simulateUpload}
        onFileUpload={handleFileUpload}
        uploadedFilesList={uploadedFiles.map(f => ({
          ...f,
          sistemaLabel: f.sistemaLabel || 'Detectando…',
          removeFile: () => setUploadedFiles(prev => prev.filter(x => x.id !== f.id)),
        }))}
        removeAllFiles={removeAllFiles}
        canEliminarTodos={puede('boton:carga.eliminar_todos')}
        canConvertir={puede('boton:carga.convertir')}
        canBorrarLibro={puede('boton:carga.borrar_libro')}
        canDescargarCsv={puede('boton:carga.descargar_csv')}
        canConvert={hasAnyUpload}
        convertHelpText={
          converted
            ? 'Ya existe un análisis generado para estos reportes.'
            : hasAnyUpload
            ? 'Se detecta automáticamente el sistema de cada reporte adjuntado (Aloha, Hiopos o Universal) para armar el libro de ventas unificado.'
            : 'Adjuntá un reporte de Aloha, Hiopos o del Formato Universal para habilitar el análisis.'
        }
        convertBtnStyle={
          hasAnyUpload || converted
            ? 'background:#f0a63d;color:#1a1a1a;border:none;border-radius:7px;padding:12px 20px;font-size:13px;font-weight:700;cursor:pointer'
            : 'background:#e5e2da;color:#9aa1ab;border:none;border-radius:7px;padding:12px 20px;font-size:13px;font-weight:700;cursor:not-allowed'
        }
        doConvert={doConvert}
        converting={converting}
        convertError={convertError}
        converted={converted}
        showCargaCard={!converted || cargaUploaderOpen}
        showStep2Content={converted && !cargaUploaderOpen}
        openCargaUploader={() => setCargaUploaderOpen(true)}
        closeCargaUploader={() => setCargaUploaderOpen(false)}
        goToRg90={() => navigate('/ventas/rg90/adjuntar')}
        saltosRows={correlatividadRows}
        deleteLibro={deleteLibro}
        downloadLimpio={() => downloadLimpio(filteredLibro)}
        descargandoLimpio={descargandoLimpio}
        pagedLibro={pagedLibro}
        libroColumnFilters={libroColumnFilters}
        hayLibroColFiltrosActivos={hayLibroColFiltrosActivos}
        limpiarLibroColFiltros={limpiarLibroColFiltros}
        libroTotales={libroTotales}
        filterStyleTodos={filtro === 'Todos' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
        filterStyleAloha={filtro === 'Aloha' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
        filterStyleHiopos={filtro === 'Hiopos' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
        filterStyleUniversal={filtro === 'Universal' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
        setFilterTodos={() => { setFiltro('Todos'); setPage(1); }}
        setFilterAloha={() => { setFiltro('Aloha'); setPage(1); }}
        setFilterHiopos={() => { setFiltro('Hiopos'); setPage(1); }}
        setFilterUniversal={() => { setFiltro('Universal'); setPage(1); }}
        searchGeneral={searchGeneral}
        onSearchGeneral={(e) => { setSearchGeneral(e.target.value); setPage(1); }}
        clearSearch={() => { setSearchGeneral(''); setPage(1); }}
        filteredCount={filteredLibro.length}
        currentPage={currentPage}
        totalPages={totalPages}
        prevPage={() => setPage(p => Math.max(1, p - 1))}
        nextPage={() => setPage(p => Math.min(totalPages, p + 1))}
        pageRangeLabel={
          filteredLibro.length === 0
            ? '0'
            : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredLibro.length)}`
        }
        prevBtnStyle={`background:#fff;border:1px solid #e2e0da;color:${currentPage <= 1 ? '#c7c3ba' : '#128752'};border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:${currentPage <= 1 ? 'default' : 'pointer'}`}
        nextBtnStyle={`background:#fff;border:1px solid #e2e0da;color:${currentPage >= totalPages ? '#c7c3ba' : '#128752'};border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:${currentPage >= totalPages ? 'default' : 'pointer'}`}
        onVerTodos={() => navigate('/ventas/libro-completo')}
        step2Cards={[
          { label: 'Locales', value: `${new Set(libroRows.map(r => r.local)).size}` },
          { label: 'Comprobantes', value: `${libroRows.length}` },
          { label: 'Saltos', value: `${totalFaltantes(correlatividadRows)}` },
        ]}
      />
  );
}

export function VentasLibroRoute() {
  const {
    descargandoLimpio, downloadLimpio, libroCompletoFiltrado, libroCompletoSearch, libroRows, navigate, setLibroCompletoSearch,
  } = useVentasCtx();
  return (
      <LibroCompletoView
        rows={libroCompletoFiltrado}
        totalSinFiltrar={libroRows.length}
        search={libroCompletoSearch}
        onSearch={(e) => setLibroCompletoSearch(e.target.value)}
        onVolver={() => { setLibroCompletoSearch(''); navigate('/ventas/carga'); }}
        onDownload={() => downloadLimpio(libroCompletoFiltrado)}
        descargando={descargandoLimpio}
      />
  );
}

export function VentasCorrelRoute() {
  const {
    correlFiltro, filteredCorrel, setCorrelFiltro,
  } = useVentasCtx();
  return (
      <CorrelatividadView
        correlatividad={filteredCorrel}
        correlFiltro={correlFiltro}
        correlFilterStyleTodos={correlFiltro === 'Todos' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
        correlFilterStyleAloha={correlFiltro === 'Aloha' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
        correlFilterStyleHiopos={correlFiltro === 'Hiopos' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
        setCorrelTodos={() => setCorrelFiltro('Todos')}
        setCorrelAloha={() => setCorrelFiltro('Aloha')}
        setCorrelHiopos={() => setCorrelFiltro('Hiopos')}
      />
  );
}

export function VentasRg90Route() {
  const {
    rg90Busy, analyzeRg90, correlatividadRows, diffAllValuesPorColumna, filteredRg90Diff, filteredRg90Rows, handleRg90FileUpload, hayRg90GridColFiltrosActivos, libroRows, limpiarRg90GridColFiltros, navigate, pagedRg90Rows, puede, quitarRg90Archivo, resetRg90, rg90Attached, rg90CardsState, rg90CategoryFilter, rg90Error, rg90Files, rg90GapsRows, rg90GridColumnFilters, rg90GridCurrentPage, rg90GridSearch, rg90GridTotalPages, rg90GridTotales, rg90Loaded, rg90PasoMostrado, rg90Rows, rg90Search, rg90Summary, setRg90CategoryFilter, setRg90GridPage, setRg90GridSearch, setRg90Search, simulateRg90Upload, wizardSteps,
  } = useVentasCtx();
  return (
      <RG90View
        wizardSteps={wizardSteps}
        pasoMostrado={rg90PasoMostrado}
        onVolverCarga={() => navigate('/ventas/carga')}
        onSiguienteResultado={() => rg90Loaded && navigate('/ventas/rg90/resultado')}
        onVolverPaso3={() => navigate('/ventas/rg90/adjuntar')}
        saltosLibroRows={correlatividadRows}
        saltosRgRows={rg90GapsRows}
        rg90Loaded={rg90Loaded}
        rg90Attached={rg90Attached}
        rg90StatusText={
          rg90Busy
            ? 'Analizando y comparando contra la RG90 en el servidor…'
            : rg90Loaded
            ? `Archivo cargado y comparado — ${rg90Files.map(f => f.name).join(', ')}`
            : rg90Attached
            ? `Archivo adjuntado — ${rg90Files.map(f => f.name).join(', ')}. Presioná "Analizar y comparar" para generar el resultado.`
            : ''
        }
        rg90FileLabel={rg90Attached ? `${rg90Files.length} archivo(s) adjuntado(s) — click para agregar más` : 'Adjuntar archivo(s) RG90 (.xls / .xlsx)'}
        rg90FileNames={rg90Files.map(f => f.name)}
        rg90DropzoneStyle={
          (rg90Attached ? 'background:#f4f2ed;color:#22262b;font-weight:600' : 'background:#fafbfa;color:#5c6470;border:1px dashed #cfd6d0') +
          ';flex:1;min-width:220px;border-radius:7px;padding:9px 14px;font-size:12.5px;cursor:pointer'
        }
        rg90AnalyzeBtnStyle={
          rg90Attached && !rg90Busy
            ? 'background:#f0a63d;color:#1a1a1a;border:none;border-radius:7px;padding:10px 16px;font-size:12.5px;font-weight:700;cursor:pointer'
            : 'background:#e5e2da;color:#9aa1ab;border:none;border-radius:7px;padding:10px 16px;font-size:12.5px;font-weight:700;cursor:not-allowed'
        }
        rg90Analyzing={rg90Busy}
        rg90Error={rg90Error}
        canComparar={puede('boton:rg90.comparar')}
        canQuitarArchivo={puede('boton:rg90.quitar_archivo')}
        simulateRg90={simulateRg90Upload}
        onRg90FileUpload={handleRg90FileUpload}
        onQuitarRg90Archivo={quitarRg90Archivo}
        analyzeRg90={analyzeRg90}
        resetRg90={resetRg90}
        rg90Cards={rg90CardsState.map(c => ({
          ...c,
          isActive: rg90CategoryFilter === c.key,
          onClick: () => setRg90CategoryFilter(prev => (prev === c.key ? '' : c.key)),
        }))}
        anuladasCount={rg90Summary?.anuladas ?? 0}
        totalLibroCount={libroRows.length}
        rg90Diff={filteredRg90Diff}
        diffAllValuesPorColumna={diffAllValuesPorColumna}
        rg90Search={rg90Search}
        onRg90Search={(e) => setRg90Search(e.target.value)}
        clearRg90Search={() => setRg90Search('')}
        rg90CategoryFilter={rg90CategoryFilter}
        clearRg90Category={() => setRg90CategoryFilter('')}
        rg90GridRows={pagedRg90Rows}
        rg90GridExportRows={filteredRg90Rows}
        rg90GridTotalCount={rg90Rows.length}
        rg90GridFilteredCount={filteredRg90Rows.length}
        rg90GridColumnFilters={rg90GridColumnFilters}
        hayRg90GridColFiltrosActivos={hayRg90GridColFiltrosActivos}
        limpiarRg90GridColFiltros={limpiarRg90GridColFiltros}
        rg90GridTotales={rg90GridTotales}
        rg90GridSearch={rg90GridSearch}
        onRg90GridSearch={(e) => { setRg90GridSearch(e.target.value); setRg90GridPage(1); }}
        rg90GridCurrentPage={rg90GridCurrentPage}
        rg90GridTotalPages={rg90GridTotalPages}
        rg90GridPrevPage={() => setRg90GridPage(p => Math.max(1, p - 1))}
        rg90GridNextPage={() => setRg90GridPage(p => Math.min(rg90GridTotalPages, p + 1))}
      />
  );
}

export function VentasModales() {
  const {
    converting, libroProgress, convertError, setConvertError, rg90Progress, rg90Error, setRg90Error, rg90DuplicadosError, setRg90DuplicadosError,
  } = useVentasCtx();
  return (
    <>
{/* Overlay bloqueante con barra de progreso mientras se lee/analiza el Excel del
    Libro (Paso 1→2, ver doConvert) -- nada de la pantalla siguiente queda visible
    detrás hasta que termina. Si converting sigue en pie pero libroProgress ya se
    limpió (no debería pasar, pero por las dudas) no se muestra nada roto: ambos
    se limpian juntos en el finally de doConvert. */}
{converting && libroProgress && (
  <ProgressModal
    message="Analizando archivo del Libro…"
    percent={libroProgress.percent}
    total={libroProgress.total}
    onCancel={cancelarOperacionEnCurso}
  />
)}
{/* Si termina en error (ej. archivo con formato incorrecto), se muestra con el modal
    genérico de siempre (sin barra, ya no hay ningún avance que mostrar) -- convertError
    ya viene limpio a null apenas arranca un intento nuevo (ver doConvert), así que solo
    queda en pie acá cuando la conversión ya terminó y falló. */}
{!converting && convertError && (
  <ProcessingModal error={convertError} onClose={() => setConvertError(null)} />
)}

{/* Única pantalla de progreso para "Analizar y comparar" (ver analyzeRg90) -- leer/
    analizar la RG90 y compararla contra el libro corren como un solo proceso, con un
    solo mensaje y un solo porcentaje (ver el comentario en la declaración del estado
    más arriba). Adjuntar el archivo no toca este estado. */}
{rg90Progress && (
  <ProgressModal
    message={rg90Progress.message}
    percent={rg90Progress.percent}
    total={rg90Progress.total}
    onCancel={cancelarOperacionEnCurso}
  />
)}
{/* Mismo criterio que con el Libro: sin barra, ya no hay ningún avance que mostrar --
    rg90Error ya viene limpio a null apenas arranca un intento nuevo. */}
{!rg90Progress && rg90Error && (
  <ProcessingModal error={rg90Error} onClose={() => setRg90Error(null)} />
)}

{/* Comprobantes duplicados detectados al adjuntar el Libro o la RG90 -- mismo error
    de siempre (ver ReconcileDuplicadosError), mostrado en su propia grilla en vez del
    cartel de una línea de ProcessingModal (ver el porqué en rg90DuplicadosError). */}
{rg90DuplicadosError && (
  <ComprobantesDuplicadosModal error={rg90DuplicadosError} onClose={() => setRg90DuplicadosError(null)} />
)}
    </>
  );
}
