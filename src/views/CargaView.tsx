import React, { useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Trash2, Search, Download, RefreshCw, CheckCircle2 } from 'lucide-react';
import { WizardSteps } from '../components/WizardSteps';

interface CargaViewProps {
  wizardSteps: any[];
  systemOptions: any[];
  selectedSystemKey: string;
  onSelectSystem: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  simulateUpload: () => void;
  onFileUpload: (files: FileList) => void;
  uploadedFilesList: any[];
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
  setFilterTodos: () => void;
  setFilterAloha: () => void;
  setFilterHiopos: () => void;
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
  alohaLoaded: boolean;
  hioposLoaded: boolean;
}

export const CargaView: React.FC<CargaViewProps> = ({
  wizardSteps,
  systemOptions,
  selectedSystemKey,
  onSelectSystem,
  onFileUpload,
  uploadedFilesList,
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
  setFilterTodos,
  setFilterAloha,
  setFilterHiopos,
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
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>
                1. Cargar reportes en bruto de sistemas POS
              </h3>
              <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
                Seleccioná el sistema origen y adjuntá los reportes descargados (Aloha .xls / Hiopos .xls)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={selectedSystemKey}
                onChange={onSelectSystem}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e0da',
                  borderRadius: '7px',
                  padding: '9px 12px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#22262b',
                }}
              >
                {systemOptions.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} — {s.desc}
                  </option>
                ))}
              </select>

              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  backgroundColor: '#128752',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '9px 16px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UploadCloud size={16} />
                <span>Adjuntar archivo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xls,.xlsx,.csv"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files && onFileUpload(e.target.files)}
              />
            </div>
          </div>

          {/* Dropzone Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #cfd6d0',
              borderRadius: '10px',
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: '#fafbfa',
              transition: 'all 0.15s ease',
              marginBottom: '20px',
            }}
          >
            <UploadCloud size={36} color="#128752" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#22262b' }}>
              Arrastrá los reportes en bruto acá o hacé clic para seleccionar
            </div>
            <div style={{ fontSize: '11.5px', color: '#9aa1ab', marginTop: '4px' }}>
              Formatos soportados: Excel (.xls, .xlsx) descargados directamente de Aloha o Hiopos
            </div>
          </div>

          {/* Uploaded Files List */}
          {uploadedFilesList.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470', marginBottom: '8px' }}>
                Archivos adjuntados ({uploadedFilesList.length}):
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
                        <div style={{ fontSize: '11px', color: '#9aa1ab' }}>
                          Sistema: {f.sistemaLabel} · Carga: {f.uploadedAt}
                        </div>
                      </div>
                    </div>

                    <button onClick={f.removeFile} style={parseInlineStyle(f.removeBtnStyle)}>
                      Eliminar
                    </button>
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
              {converting ? 'Procesando archivos en el servidor…' : convertHelpText}
            </div>

            <button
              onClick={doConvert}
              disabled={converting}
              style={{ ...parseInlineStyle(convertBtnStyle), opacity: converting ? 0.7 : 1, cursor: converting ? 'wait' : parseInlineStyle(convertBtnStyle).cursor }}
            >
              {converting ? 'Analizando…' : 'Analizar y convertir'}
            </button>
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
            </div>

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

          {/* Table Container */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Documento</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Sistema</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Local</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Fecha</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>RUC</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Nombre</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Gravadas 10%</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>IVA 10%</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Gravadas 5%</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>IVA 5%</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Exentas</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Estado</th>
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
