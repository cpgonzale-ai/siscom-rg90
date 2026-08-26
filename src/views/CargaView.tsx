import React, { useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Trash2, Search, Download, RefreshCw, CheckCircle2 } from 'lucide-react';
import { WizardSteps } from '../components/WizardSteps';
import { ExcelFilterHeader } from '../components/ExcelFilterHeader';
import { secondaryBtnStyle } from '../components/Modal';

// Mismo formato que usa el backend para los importes ("18.891.429,00") — para el
// totalizador del pie de tabla, que se calcula acá con los campos _num del libro.
const formatGs = (n: number): string => n.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  deleteLibro: () => void;
  downloadLimpio: () => void;
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
  showCargaCard,
  showStep2Content,
  openCargaUploader,
  deleteLibro,
  downloadLimpio,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 3 Step Wizard Progress Bar */}
      <WizardSteps steps={wizardSteps} />

      {/* Step 1: Upload Card */}
      {showCargaCard && (
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
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>
              1. Adjuntar el libro de ventas del sistema
            </h3>
          </div>

          {/* Dropzone — mismo tamaño y texto que el de Libro de Compras: ya no hace falta
              elegir el sistema antes de adjuntar, se detecta automáticamente por archivo al
              analizar (ver el campo "Sistema" apagado en el listado de abajo). */}
          <label
            style={{
              display: 'flex',
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
              marginBottom: '20px',
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
              accept=".xls,.xlsx,.csv"
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files && e.target.files.length > 0) onFileUpload(e.target.files); e.target.value = ''; }}
            />
          </label>

          {/* Uploaded Files List */}
          {uploadedFilesList.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>
                  Archivos adjuntados ({uploadedFilesList.length}):
                </div>
                {canEliminarTodos && (
                  <button
                    onClick={removeAllFiles}
                    style={{
                      background: '#fff',
                      border: '1px solid #e2e0da',
                      color: '#b3402f',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Eliminar todos</span>
                  </button>
                )}
              </div>

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
                          muestra lo que se detectó, no es editable. */}
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
                      <button onClick={f.removeFile} style={parseInlineStyle(f.removeBtnStyle)}>
                        Eliminar
                      </button>
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

          {/* Convert Action Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: '1px solid #f0eee8',
            }}
          >
            <div style={{ fontSize: '12px', color: '#5c6470', flex: 1 }}>
              {!canConvertir ? 'No tenés permiso para convertir reportes.' : converting ? 'Procesando archivos en el servidor…' : convertHelpText}
            </div>

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
        </div>
      )}

      {/* Step 2: Converted Sales Book Table Card */}
      {showStep2Content && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="#128752" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>
                  2. Libro de Ventas Unificado y Limpio
                </h3>
              </div>
              <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
                Reportes consolidados y sanitizados para el período 01–10 junio 2026
              </p>
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
                  style={{
                    backgroundColor: '#f0a63d',
                    color: '#1a1a1a',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '9px 16px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Download size={14} />
                  <span>Descargar CSV</span>
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
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  {['doc', 'tipo_doc', 'sistema', 'local', 'fecha', 'ruc', 'nombre'].map(key => {
                    const col = libroColumnFilters.find(c => c.key === key);
                    if (!col) return <th key={key} style={{ padding: '12px 14px', fontWeight: 600 }} />;
                    return (
                      <th key={key} style={{ padding: '12px 14px', fontWeight: 600 }}>
                        <ExcelFilterHeader label={col.label} allValues={col.allValues} active={col.active} onChange={col.onChange} />
                      </th>
                    );
                  })}
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Gravadas 10%</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>IVA 10%</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Gravadas 5%</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>IVA 5%</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Exentas</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>
                    {(() => {
                      const col = libroColumnFilters.find(c => c.key === 'estado');
                      return col ? <ExcelFilterHeader label={col.label} allValues={col.allValues} active={col.active} onChange={col.onChange} /> : 'Estado';
                    })()}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedLibro.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>
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
                      <span style={parseInlineStyle(r.estadoStyle)}>{r.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e0da', backgroundColor: '#fafbfa', fontWeight: 700, color: '#22262b' }}>
                  <td colSpan={7} style={{ padding: '12px 14px' }}>Total ({filteredCount.toLocaleString('es-PY')} filas)</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.gravadas)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.iva)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.gravadas_5)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.iva_5)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.exentas)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatGs(libroTotales.total)}</td>
                  <td />
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
