import React, { useRef } from 'react';
import { GitCompare, UploadCloud, RefreshCw, X, ArrowLeft, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { WizardSteps } from '../components/WizardSteps';
import { ExcelFilterHeader } from '../components/ExcelFilterHeader';
import { primaryBtnStyle, secondaryBtnStyle } from '../components/Modal';

// Misma fila de navegación (Volver / Siguiente) que usa Libro de Compras arriba de cada
// paso, en vez de abajo.
const navRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const disabledBtnStyle: React.CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };

// Mismo formato que usa el backend para los importes ("18.891.429,00") — para el
// totalizador del pie de tabla de la grilla de la RG90.
const formatGs = (n: number): string => n.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  analyzeRg90: () => void;
  resetRg90: () => void;
  rg90Cards: any[];
  rg90Diff: any[];
  rg90ByLocal: any[];
  rg90Search: string;
  onRg90Search: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearRg90Search: () => void;
  rg90CategoryFilter: string;
  clearRg90Category: () => void;
  // Grilla del Paso 3 (registros de la RG90 tal como se parsearon)
  rg90GridRows: any[];
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
  analyzeRg90,
  resetRg90,
  rg90Cards,
  rg90Diff,
  rg90ByLocal,
  rg90Search,
  onRg90Search,
  rg90CategoryFilter,
  clearRg90Category,
  rg90GridRows,
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colFilter = (key: string) => rg90GridColumnFilters.find(c => c.key === key);

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

            {rg90Loaded && canQuitarArchivo && (
              <button
                onClick={resetRg90}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e0da',
                  color: '#b3402f',
                  borderRadius: '7px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={14} />
                <span>Quitar archivo RG90</span>
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
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#fafbfa', border: '1px solid #f0eee8', borderRadius: '7px', fontSize: '12.5px', color: '#22262b' }}>
                  <FileSpreadsheet size={14} color="#5c6470" />
                  <span>{name}</span>
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
                <input
                  type="text" placeholder="Buscar..." value={rg90GridSearch}
                  onChange={onRg90GridSearch}
                  style={{ padding: '7px 12px', border: '1px solid #e2e0da', borderRadius: '6px', fontSize: '12px', width: '200px' }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                    {['doc', 'tipo_doc', 'sistema', 'local', 'fecha', 'ruc', 'nombre'].map(key => {
                      const col = colFilter(key);
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
                        const col = colFilter('estado');
                        return col ? <ExcelFilterHeader label={col.label} allValues={col.allValues} active={col.active} onChange={col.onChange} /> : 'Estado';
                      })()}
                    </th>
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

      {pasoMostrado === 4 && (
        <>
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

        {/* RG90 Summary Filter Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
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
                Detalle de Discrepancias e Inconsistencias
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
                  <X size={12} style={{ cursor: 'pointer' }} onClick={clearRg90Category} />
                </span>
              )}
            </div>

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

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>N° Documento</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Sistema</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Local</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Monto Libro Propio</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Monto RG90 SET</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Diferencia / Diagnóstico</th>
              </tr>
            </thead>
            <tbody>
              {rg90Diff.map((r: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>
                  <td style={{ padding: '12px 16px', color: '#5c6470' }}>{r.sistema}</td>
                  <td style={{ padding: '12px 16px', color: '#5c6470' }}>{r.local}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#5c6470' }}>{r.libro}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#5c6470' }}>{r.rg90}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={parseInlineStyle(r.diffChipStyle)}>{r.diferencia}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Breakdown per Local Table */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e0da', backgroundColor: '#fafbfa' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>
              Resumen de Cobertura y Discrepancias por Local
            </h4>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Local</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Sistema</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Comprobantes</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Diferencias</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Saltos</th>
              </tr>
            </thead>
            <tbody>
              {rg90ByLocal.map((r: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#22262b' }}>{r.local}</td>
                  <td style={{ padding: '12px 16px', color: '#5c6470' }}>{r.sistema}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#5c6470' }}>{r.comprobantes}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: r.diferencias > 0 ? '#b3402f' : '#128752' }}>
                    {r.diferencias}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: r.saltos > 0 ? '#b0740f' : '#128752' }}>
                    {r.saltos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
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
