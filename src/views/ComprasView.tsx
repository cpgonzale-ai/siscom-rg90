import React, { useMemo, useRef, useState } from 'react';
import {
  ShoppingCart, UploadCloud, Trash2, FileSpreadsheet, X, GitCompare, RefreshCw, Download,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { secondaryBtnStyle, primaryBtnStyle, dangerBtnStyle } from '../components/Modal';
import type { Local, CompraRow, CompraDiffRow } from '../services/api';
import { ingestComprasApi, reconcileComprasApi } from '../services/api';

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

export const ComprasView: React.FC<ComprasViewProps> = ({ locales, permisos }) => {
  const puede = (clave: string) => permisos.has(clave);

  // ── Paso 1: carga del export del sistema ────────────────────────────────
  const [archivos, setArchivos] = useState<ArchivoAdjunto[]>([]);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [confirmEliminarTodos, setConfirmEliminarTodos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Paso 2: libro procesado ──────────────────────────────────────────────
  const [rows, setRows] = useState<CompraRow[]>([]);
  const [loteId, setLoteId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // ── Paso 3: comparación contra la RG ────────────────────────────────────
  const [rgFiles, setRgFiles] = useState<File[]>([]);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<CompraDiffRow[]>([]);
  const [summary, setSummary] = useState<{ coinciden: number; no_en_rg: number; no_en_libro: number; diferencia_monto: number } | null>(null);
  const [diffSearch, setDiffSearch] = useState('');
  const rgInputRef = useRef<HTMLInputElement>(null);

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
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : 'Error al procesar los archivos en el servidor.');
    } finally {
      setConverting(false);
    }
  };

  const borrarLibro = () => {
    setRows([]);
    setLoteId(undefined);
    setDiffs([]);
    setSummary(null);
    setArchivos([]);
  };

  const handleRgFileInput = (files: FileList) => {
    setRgFiles(prev => [...prev, ...Array.from(files)]);
    setCompareError(null);
  };

  const quitarRg = () => {
    setRgFiles([]);
    setDiffs([]);
    setSummary(null);
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
      setDiffs(res.diffs || []);
      setSummary(res.summary);
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : 'Error al comparar contra la RG.');
    } finally {
      setComparing(false);
    }
  };

  const descargarCsv = () => {
    if (rows.length === 0) return;
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Documento', 'Local', 'Fecha', 'RUC Proveedor', 'Proveedor', 'Tipo', 'Condición', 'Timbrado', 'Gravada 10%', 'IVA 10%', 'Gravada 5%', 'IVA 5%', 'Exenta', 'Total', 'Estado'];
    const dataRows = rows.map(r => [
      r.doc, r.local, r.fecha, `${r.ruc_proveedor}-${r.dv_proveedor}`, r.proveedor, r.tipo_doc, r.condicion, r.timbrado,
      r.gravadas, r.iva, r.gravadas_5, r.iva_5, r.exentas, r.total, r.estado,
    ].map(esc).join(';'));
    const csv = '﻿' + [headers.map(esc).join(';'), ...dataRows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Libro_de_Compras.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }, [rows, search]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filteredDiffs = useMemo(() => {
    if (!diffSearch.trim()) return diffs;
    const q = diffSearch.trim().toLowerCase();
    return diffs.filter(d => Object.values(d).some(v => String(v).toLowerCase().includes(q)));
  }, [diffs, diffSearch]);

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
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingCart size={20} color="#128752" />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>Libro de Compras</h3>
        </div>
        <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
          Cargá el export del libro de compras del sistema, revisá el detalle y comparalo contra la RG (Minuta 5).
        </p>
      </div>

      {/* Paso 1: carga */}
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
          <div onClick={() => fileInputRef.current?.click()} style={dropzoneStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <UploadCloud size={18} color="#128752" />
              <span>{archivos.length > 0 ? `${archivos.length} archivo(s) adjuntado(s) — click para agregar más` : 'Click para adjuntar el archivo (.xls, .xlsx)'}</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFileInput(e.target.files); e.target.value = ''; }}
          />
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

      {/* Paso 2: libro procesado */}
      {rows.length > 0 && (
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e0da', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafbfa', flexWrap: 'wrap', gap: '10px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>2. Libro de Compras ({rows.length.toLocaleString('es-PY')} comprobantes)</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="text" placeholder="Buscar..." value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ padding: '7px 12px', border: '1px solid #e2e0da', borderRadius: '6px', fontSize: '12px', width: '200px' }}
              />
              {puede('boton:compras.descargar_csv') && (
                <button onClick={descargarCsv} style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={14} />
                  <span>CSV</span>
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
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Documento</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Local</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Fecha</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>RUC / Proveedor</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>IVA 10%</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>IVA 5%</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Estado</th>
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
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva_5}</td>
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

      {/* Paso 3: comparación contra la RG */}
      {rows.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitCompare size={20} color="#128752" />
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>3. Comparación contra la RG (SET) — Compras</h4>
              </div>
              <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
                Clave de comparación: documento + RUC del proveedor (sin dígito verificador) — un mismo número de documento puede repetirse entre proveedores distintos.
              </p>
            </div>
            {rgFiles.length > 0 && puede('boton:compras.quitar_archivo') && (
              <button onClick={quitarRg} style={{ ...secondaryBtnStyle, color: '#b3402f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} />
                <span>Quitar archivo RG</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div onClick={() => rgInputRef.current?.click()} style={dropzoneStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <UploadCloud size={18} color="#128752" />
                <span>{rgFiles.length > 0 ? `${rgFiles.length} archivo(s) RG adjuntado(s)` : 'Click para adjuntar el archivo de la RG (compras)'}</span>
              </div>
            </div>
            <input
              ref={rgInputRef}
              type="file"
              accept=".xls,.xlsx"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleRgFileInput(e.target.files); e.target.value = ''; }}
            />
            {puede('boton:compras.comparar') && (
              <button onClick={doComparar} disabled={comparing} style={{ ...primaryBtnStyle, opacity: comparing ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                {comparing ? 'Comparando…' : 'Analizar y comparar'}
              </button>
            )}
          </div>

          {compareError && <div style={errorBoxStyle}>{compareError}</div>}
        </div>
      )}

      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', padding: '16px 20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>Coinciden</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#128752', marginTop: '4px' }}>{summary.coinciden}</div>
            </div>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', padding: '16px 20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>No en RG</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#b3402f', marginTop: '4px' }}>{summary.no_en_rg}</div>
            </div>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', padding: '16px 20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>No en libro propio</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#b3402f', marginTop: '4px' }}>{summary.no_en_libro}</div>
            </div>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', padding: '16px 20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>Diferencia de monto</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#b0740f', marginTop: '4px' }}>{summary.diferencia_monto}</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e0da', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafbfa' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>Detalle de Discrepancias</h4>
              <input
                type="text" placeholder="Buscar por doc, proveedor..." value={diffSearch}
                onChange={e => setDiffSearch(e.target.value)}
                style={{ padding: '7px 12px', border: '1px solid #e2e0da', borderRadius: '6px', fontSize: '12px', width: '220px' }}
              />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Documento</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Proveedor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Local</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Monto Libro Propio</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Monto RG</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Diferencia / Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiffs.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#22262b' }}>{d.doc}</td>
                    <td style={{ padding: '12px 16px', color: '#5c6470' }}>{d.proveedor}</td>
                    <td style={{ padding: '12px 16px', color: '#5c6470' }}>{d.local}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#5c6470' }}>{d.libro}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#5c6470' }}>{d.rg}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: d.diferencia === 'Diferencia de monto' ? '#fdf1de' : '#fbe9e3',
                        color: d.diferencia === 'Diferencia de monto' ? '#b0740f' : '#b3402f',
                        fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                      }}>
                        {d.diferencia}
                        {d.diferencias_detalle ? ` (${Object.keys(d.diferencias_detalle).join(', ')})` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
