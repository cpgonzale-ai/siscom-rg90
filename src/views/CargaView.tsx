import { totalFaltantes } from '../utils/saltos';
import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Trash2, Search, Download, RefreshCw, CheckCircle2, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { WizardSteps } from '../components/WizardSteps';
import { ExcelFilterHeader } from '../components/ExcelFilterHeader';
import { ColumnPicker } from '../components/ColumnPicker';
import { Modal, primaryBtnStyle, secondaryBtnStyle, dangerBtnStyle, excelBtnStyle, navRowStyle, disabledBtnStyle, stickyTheadStyle, scrollableGridStyle } from '../components/Modal';
import { TablaSaltos } from '../components/TablaSaltos';
import { formatGs } from '../utils/format';
import { parseInlineStyle } from '../utils/estilos';

interface CargaViewProps {
  wizardSteps: any[];
  systemOptions: any[];
  selectedSystemKey: string;
  onSelectSystem: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  simulateUpload: () => void;
  onFileUpload: (files: FileList) => void;
  uploadedFilesList: any[];
  removeAllFiles: () => void;
  canEliminarTodos: boolean;
  canConvertir: boolean;
  canBorrarLibro: boolean;
  canDescargarCsv: boolean;
  canConvert: boolean;
  convertHelpText: string;
  convertBtnStyle: string;
  doConvert: () => void;
  converting: boolean;
  convertError: string | null;
  converted: boolean;
  showCargaCard: boolean;
  showStep2Content: boolean;
  openCargaUploader: () => void;
  closeCargaUploader: () => void;
  goToRg90: () => void;
  saltosRows: any[];
  deleteLibro: () => void;
  downloadLimpio: () => void;
  descargandoLimpio: boolean;
  pagedLibro: any[];
  filterStyleTodos: string;
  filterStyleAloha: string;
  filterStyleHiopos: string;
  filterStyleUniversal: string;
  setFilterTodos: () => void;
  setFilterAloha: () => void;
  setFilterHiopos: () => void;
  setFilterUniversal: () => void;
  searchGeneral: string;
  onSearchGeneral: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearSearch: () => void;
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  prevPage: () => void;
  nextPage: () => void;
  pageRangeLabel: string;
  prevBtnStyle: string;
  nextBtnStyle: string;
  onVerTodos: () => void;
  step2Cards: any[];
  libroColumnFilters: { key: string; label: string; allValues: string[]; active: Set<string> | null; onChange: (next: Set<string> | null) => void }[];
  hayLibroColFiltrosActivos: boolean;
  limpiarLibroColFiltros: () => void;
  libroTotales: { gravadas: number; iva: number; gravadas_5: number; iva_5: number; exentas: number; total: number };
}

export const CargaView: React.FC<CargaViewProps> = ({
  wizardSteps,
  onFileUpload,
  uploadedFilesList,
  removeAllFiles,
  canEliminarTodos,
  canConvertir,
  canBorrarLibro,
  canDescargarCsv,
  convertHelpText,
  convertBtnStyle,
  doConvert,
  converting,
  convertError,
  converted,
  showCargaCard,
  showStep2Content,
  openCargaUploader,
  closeCargaUploader,
  goToRg90,
  saltosRows,
  deleteLibro,
  downloadLimpio,
  descargandoLimpio,
  pagedLibro,
  filterStyleTodos,
  filterStyleAloha,
  filterStyleHiopos,
  filterStyleUniversal,
  setFilterTodos,
  setFilterAloha,
  setFilterHiopos,
  setFilterUniversal,
  searchGeneral,
  onSearchGeneral,
  clearSearch,
  filteredCount,
  currentPage,
  totalPages,
  prevPage,
  nextPage,
  pageRangeLabel,
  prevBtnStyle,
  nextBtnStyle,
  onVerTodos,
  libroColumnFilters,
  hayLibroColFiltrosActivos,
  limpiarLibroColFiltros,
  libroTotales,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Visibilidad de columnas en pantalla (Paso 2) — no afecta la exportación a Excel a
  // propósito: downloadLimpio (App.tsx) arma el archivo a partir de LIBRO_COLUMNAS
  // completo, sin mirar este estado, así que el .xlsx siempre trae todas las columnas
  // aunque el usuario tenga alguna oculta acá. Ocultas por defecto: Gravadas 10%, IVA 10%,
  // Gravadas 5%, IVA 5%, Exentas.
  const [libroColOcultas, setLibroColOcultas] = useState<Set<string>>(
    new Set(['gravadas', 'iva', 'gravadas_5', 'iva_5', 'exentas'])
  );
  const libroColVisiblesKeys = new Set(libroColumnFilters.filter(c => !libroColOcultas.has(c.key)).map(c => c.key));
  const libroLeadingColSpan = ['doc', 'tipo_doc', 'sistema', 'local', 'fecha', 'ruc', 'nombre']
    .filter(k => libroColVisiblesKeys.has(k)).length;
  const [saltosModalOpen, setSaltosModalOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 3 Step Wizard Progress Bar */}
      <WizardSteps steps={wizardSteps} />

      {/* Step 1: Upload Card */}
      {showCargaCard && (
        <>
        <div style={navRowStyle}>
          <span />
          <button
            onClick={closeCargaUploader}
            disabled={!converted}
            style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px', ...(!converted ? disabledBtnStyle : {}) }}
          >
            <span>Siguiente: Ver libro unificado</span>
            <ArrowRight size={16} />
          </button>
        </div>
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e0da',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>
                1. Adjuntar el libro de ventas del sistema
              </h3>
              {/* Mismo lugar que rg90StatusText en RG90View Paso3: texto de ayuda bajo el
                  título, no junto al botón (que se movió arriba, al lado del dropzone) —
                  así el botón no se corre de lugar aunque este texto cambie de largo. */}
              <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
                {!canConvertir ? 'No tenés permiso para convertir reportes.' : converting ? 'Procesando archivos en el servidor…' : convertHelpText}
              </p>
            </div>
            {/* Misma posición y estilo en las 4 secciones de la app donde se adjuntan
                archivos (acá, RG90View Paso3, ComprasView Paso1 y Paso2): el botón que
                elimina todo lo adjuntado va en el header, junto al título. */}
            {uploadedFilesList.length > 0 && canEliminarTodos && (
              <button
                onClick={removeAllFiles}
                style={{ ...dangerBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={14} />
                <span>Eliminar todos</span>
              </button>
            )}
          </div>

          {/* Dropzone + botón "Analizar y convertir" en la misma fila, igual que el Paso 3
              (RG90View, adjuntar RG90) — así el botón queda siempre arriba, sin importar
              cuántos archivos se vayan adjuntando y agregando a la lista de abajo. */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
            <label
              style={{
                display: 'flex',
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                border: '2px dashed #e2e0da',
                borderRadius: '9px',
                padding: '18px',
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#5c6470',
                backgroundColor: '#fafbfa',
              }}
            >
              <UploadCloud size={18} color="#128752" />
              <span>
                {uploadedFilesList.length > 0
                  ? `${uploadedFilesList.length} archivo(s) adjuntado(s) — click para agregar más`
                  : 'Click para adjuntar el archivo (.xls, .xlsx)'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xls,.xlsx"
                style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files && e.target.files.length > 0) onFileUpload(e.target.files); e.target.value = ''; }}
              />
            </label>

            {canConvertir && (
              <button
                onClick={doConvert}
                disabled={converting}
                style={{ ...parseInlineStyle(convertBtnStyle), opacity: converting ? 0.7 : 1, cursor: converting ? 'wait' : parseInlineStyle(convertBtnStyle).cursor }}
              >
                {converting ? 'Analizando…' : 'Analizar y convertir'}
              </button>
            )}
          </div>

          {/* Uploaded Files List */}
          {uploadedFilesList.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {uploadedFilesList.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e0da',
                      borderRadius: '8px',
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileSpreadsheet size={18} color="#128752" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#22262b' }}>{f.fileName}</div>
                        <div style={{ fontSize: '11px', color: '#9aa1ab', marginTop: '2px' }}>
                          Carga: {f.uploadedAt}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Campo "apagado": el sistema ya no se elige antes de adjuntar, se
                          detecta al analizar (ver doConvert en App.tsx) — acá solo se
                          muestra lo que se detectó, no es editable. Mientras todavía no se
                          analizó, se oculta en vez de mostrar "Detectando…". */}
                      {f.sistemaLabel !== 'Detectando…' && (
                        <span
                          title="Sistema detectado automáticamente al analizar"
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#9aa1ab',
                            backgroundColor: '#f0eee8',
                            border: '1px solid #e2e0da',
                            borderRadius: '6px',
                            padding: '5px 10px',
                            cursor: 'not-allowed',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {f.sistemaLabel}
                        </span>
                      )}
                      <X size={14} style={{ cursor: 'pointer', color: '#9aa1ab' }} onClick={f.removeFile} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error banner: si el backend falló o no encontró comprobantes, se avisa acá
              en vez de avanzar mostrando datos que no corresponden al archivo cargado. */}
          {convertError && (
            <div
              style={{
                backgroundColor: '#fbe9e3',
                border: '1px solid #eec3b5',
                color: '#8a3a26',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12.5px',
                marginBottom: '16px',
              }}
            >
              {convertError}
            </div>
          )}
        </div>
        </>
      )}

      {/* Step 2: Converted Sales Book Table Card */}
      {showStep2Content && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={navRowStyle}>
            <button onClick={openCargaUploader} style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} />
              <span>Volver</span>
            </button>
            <button onClick={goToRg90} style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Siguiente: Comparación RG90</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Action Header Card */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e0da',
              borderRadius: '12px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} color="#128752" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>
                2. Libro de Ventas Unificado y Limpio
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={openCargaUploader}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e0da',
                  color: '#5c6470',
                  borderRadius: '7px',
                  padding: '9px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={14} />
                <span>Cargar más reportes</span>
              </button>

              {canBorrarLibro && (
                <button
                  onClick={deleteLibro}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e0da',
                    color: '#b3402f',
                    borderRadius: '7px',
                    padding: '9px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Trash2 size={14} />
                  <span>Borrar libro</span>
                </button>
              )}

              {canDescargarCsv && (
                <button
                  onClick={downloadLimpio}
                  disabled={descargandoLimpio}
                  style={{ ...excelBtnStyle, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px', ...(descargandoLimpio ? { opacity: 0.7, cursor: 'wait' } : {}) }}
                >
                  <Download size={14} />
                  <span>{descargandoLimpio ? 'Generando Excel…' : 'Excel'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Los cortes/subtotales del reporte original ya no se muestran acá — quedan
              guardados en memoria (App.tsx) para usarse al armar el libro en limpio. */}

          {/* Cards & Controls Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={setFilterTodos} style={parseInlineStyle(filterStyleTodos)}>
                Todos ({filteredCount})
              </button>
              <button onClick={setFilterAloha} style={parseInlineStyle(filterStyleAloha)}>
                Aloha
              </button>
              <button onClick={setFilterHiopos} style={parseInlineStyle(filterStyleHiopos)}>
                Hiopos
              </button>
              <button onClick={setFilterUniversal} style={parseInlineStyle(filterStyleUniversal)}>
                Universal
              </button>
              {/* No es un filtro de esta grilla — abre el detalle en un modal (ver más
                  abajo), mismo estilo que los botones de sistema para que quede en la
                  misma fila, a la derecha de Universal. */}
              <button
                onClick={() => setSaltosModalOpen(true)}
                style={{
                  background: '#ffffff', border: '1px solid #e2e0da', color: '#5c6470',
                  borderRadius: '7px', padding: '8px 14px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Saltos ({totalFaltantes(saltosRows)})
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ColumnPicker columnas={libroColumnFilters} ocultas={libroColOcultas} onChange={setLibroColOcultas} />

              {hayLibroColFiltrosActivos && (
                <button onClick={limpiarLibroColFiltros} style={{ ...secondaryBtnStyle, padding: '9px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  Limpiar filtros
                </button>
              )}

              {/* Universal Search Input */}
              <div style={{ position: 'relative', width: '320px' }}>
                <Search
                  size={16}
                  color="#9aa1ab"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  placeholder="Buscar por doc, RUC, cliente, local..."
                  value={searchGeneral}
                  onChange={onSearchGeneral}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    border: '1px solid #e2e0da',
                    borderRadius: '7px',
                    fontSize: '12.5px',
                    backgroundColor: '#ffffff',
                  }}
                />
                {searchGeneral && (
                  <button
                    onClick={clearSearch}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      color: '#9aa1ab',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={scrollableGridStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  {libroColumnFilters.filter(col => !libroColOcultas.has(col.key)).map(col => {
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
                {pagedLibro.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                    {!libroColOcultas.has('doc') && <td style={{ padding: '12px 14px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>}
                    {!libroColOcultas.has('tipo_doc') && (
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            background: r.tipo_doc === 'Nota de Crédito' ? '#f1eef8' : '#eef2fb',
                            color: r.tipo_doc === 'Nota de Crédito' ? '#5b3aa8' : '#2f5fa8',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 9px',
                            borderRadius: '20px',
                          }}
                        >
                          {r.tipo_doc || 'Factura'}
                        </span>
                      </td>
                    )}
                    {!libroColOcultas.has('sistema') && <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.sistema}</td>}
                    {!libroColOcultas.has('local') && <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.local}</td>}
                    {!libroColOcultas.has('fecha') && <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.fecha}</td>}
                    {!libroColOcultas.has('ruc') && <td style={{ padding: '12px 14px', color: '#5c6470' }}>{r.ruc}</td>}
                    {!libroColOcultas.has('nombre') && <td style={{ padding: '12px 14px', color: '#22262b', fontWeight: 500 }}>{r.nombre}</td>}
                    {!libroColOcultas.has('gravadas') && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas}</td>}
                    {!libroColOcultas.has('iva') && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva}</td>}
                    {!libroColOcultas.has('gravadas_5') && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas_5 ?? '0'}</td>}
                    {!libroColOcultas.has('iva_5') && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva_5 ?? '0'}</td>}
                    {!libroColOcultas.has('exentas') && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5c6470' }}>{r.exentas}</td>}
                    {!libroColOcultas.has('total') && <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#22262b' }}>{r.total}</td>}
                    {!libroColOcultas.has('estado') && (
                      <td style={{ padding: '12px 14px' }}>
                        <span style={parseInlineStyle(r.estadoStyle)}>{r.estado}</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e0da', backgroundColor: '#fafbfa', fontWeight: 700, color: '#22262b' }}>
                  <td colSpan={libroLeadingColSpan} style={{ padding: '12px 14px' }}>Total ({filteredCount.toLocaleString('es-PY')} filas)</td>
                  {!libroColOcultas.has('gravadas') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.gravadas)}</td>}
                  {!libroColOcultas.has('iva') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.iva)}</td>}
                  {!libroColOcultas.has('gravadas_5') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.gravadas_5)}</td>}
                  {!libroColOcultas.has('iva_5') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.iva_5)}</td>}
                  {!libroColOcultas.has('exentas') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.exentas)}</td>}
                  {!libroColOcultas.has('total') && <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.total)}</td>}
                  {!libroColOcultas.has('estado') && <td />}
                </tr>
              </tfoot>
            </table>
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderTop: '1px solid #e2e0da',
                backgroundColor: '#fafbfa',
              }}
            >
              <div style={{ fontSize: '12px', color: '#5c6470' }}>
                Mostrando {pageRangeLabel} de {filteredCount} registros
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={prevPage} style={parseInlineStyle(prevBtnStyle)}>
                    Anterior
                  </button>
                  <span style={{ fontSize: '12.5px', color: '#5c6470', padding: '0 8px' }}>
                    Página {currentPage} de {totalPages}
                  </span>
                  <button onClick={nextPage} style={parseInlineStyle(nextBtnStyle)}>
                    Siguiente
                  </button>
                </div>

                <button
                  onClick={onVerTodos}
                  style={{
                    background: '#fff',
                    border: '1px solid #128752',
                    color: '#128752',
                    borderRadius: '7px',
                    padding: '7px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Ver todos ({filteredCount})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {saltosModalOpen && (
        <Modal title={`Saltos de numeración detectados (${totalFaltantes(saltosRows)})`} onClose={() => setSaltosModalOpen(false)} width="900px">
          {saltosRows.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#5c6470' }}>No se detectaron saltos de numeración en el libro cargado.</p>
          ) : (
            <TablaSaltos rows={saltosRows} />
          )}
        </Modal>
      )}
    </div>
  );
};

