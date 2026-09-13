import React, { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { ExcelFilterHeader } from './ExcelFilterHeader';
import { secondaryBtnStyle, stickyTheadStyle, scrollableGridStyle } from './Modal';
import { downloadExcel } from '../utils/exportExcel';

const SALTOS_COLUMNAS: { key: string; label: string; getValue: (r: any) => string }[] = [
  { key: 'local', label: 'Local / Establecimiento', getValue: r => r.local },
  { key: 'sistema', label: 'Sistema', getValue: r => r.sistema },
  { key: 'tipo_doc', label: 'Tipo', getValue: r => r.tipo_doc || 'Factura' },
  { key: 'ultimo', label: 'Último N° Procesado', getValue: r => r.ultimo },
  { key: 'salto', label: 'Salto Detectado', getValue: r => r.salto },
  { key: 'cantidad', label: 'Faltantes', getValue: r => String(r.cantidad) },
];

const COLUMNA_PROVEEDOR = { key: 'proveedor', label: 'Proveedor', getValue: (r: any) => r.proveedor || '—' };

// Tabla de saltos de numeración — se usa en el modal del Paso 2 de Ventas (CargaView, solo
// libro propio), el del Paso 3 (RG90View, solo RG90) y el del Paso 4 (RG90View, combinado
// libro + RG90 con columna "Origen"); también en el Paso 2 de Compras (ComprasView, saltos
// dentro de la RG de compras, con columna "Proveedor" — ahí el salto se agrupa por
// proveedor, no tiene sentido mostrarlo sin decir de cuál es). Maneja su propio filtro por
// columna: se resetea solo al cerrar el modal, porque el componente se desmonta junto con
// él.
export const TablaSaltos: React.FC<{ rows: any[]; conOrigen?: boolean; conProveedor?: boolean }> = ({ rows, conOrigen, conProveedor }) => {
  const [colFiltros, setColFiltros] = useState<Record<string, Set<string> | null>>({});
  let columnas = conOrigen
    ? [{ key: 'origen', label: 'Origen', getValue: (r: any) => r.__origen }, ...SALTOS_COLUMNAS]
    : SALTOS_COLUMNAS;
  if (conProveedor) columnas = [columnas[0], COLUMNA_PROVEEDOR, ...columnas.slice(1)];
  let filteredRows = rows;
  for (const col of columnas) {
    const activo = colFiltros[col.key];
    if (activo) filteredRows = filteredRows.filter(r => activo.has(col.getValue(r)));
  }
  const hayFiltrosActivos = Object.values(colFiltros).some(v => v !== null && v !== undefined);

  // Excel de los saltos detectados — respeta los filtros de columna activos, igual que el
  // resto de las descargas de la app (se descarga lo que se ve en pantalla, no el total).
  const descargarExcel = () => {
    if (filteredRows.length === 0) return;
    const headers = columnas.map(col => col.label);
    const dataRows = filteredRows.map(r => columnas.map(col => col.getValue(r)));
    downloadExcel('Saltos_de_numeracion.xlsx', 'Saltos de numeración', headers, dataRows);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
        {hayFiltrosActivos && (
          <button onClick={() => setColFiltros({})} style={{ ...secondaryBtnStyle, padding: '6px 10px', fontSize: '11.5px' }}>
            Limpiar filtros
          </button>
        )}
        <button
          onClick={descargarExcel}
          disabled={filteredRows.length === 0}
          style={{ ...secondaryBtnStyle, padding: '6px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FileSpreadsheet size={13} color="#5c6470" />
          <span>Excel</span>
        </button>
      </div>
      <div style={scrollableGridStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
              {columnas.map(col => (
                <th key={col.key} style={{ ...stickyTheadStyle, padding: '10px 12px', fontWeight: 600, textAlign: col.key === 'cantidad' ? 'center' : 'left' }}>
                  <ExcelFilterHeader
                    label={col.label}
                    allValues={rows.map(col.getValue)}
                    active={colFiltros[col.key] ?? null}
                    onChange={(next) => setColFiltros(prev => ({ ...prev, [col.key]: next }))}
                    align={col.key === 'cantidad' ? 'center' : 'left'}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                {conOrigen && (
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: r.__origen === 'RG90' ? '#eef2fb' : '#e8f3ec',
                      color: r.__origen === 'RG90' ? '#2f5fa8' : '#128752',
                      fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px',
                    }}>
                      {r.__origen}
                    </span>
                  </td>
                )}
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#22262b' }}>{r.local}</td>
                {conProveedor && (
                  <td style={{ padding: '10px 12px', color: '#5c6470' }}>{r.proveedor || '—'}</td>
                )}
                <td style={{ padding: '10px 12px', color: '#5c6470' }}>{r.sistema}</td>
                <td style={{ padding: '10px 12px' }}>
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
                <td style={{ padding: '10px 12px', color: '#5c6470', fontFamily: 'monospace' }}>{r.ultimo}</td>
                <td style={{ padding: '10px 12px', color: '#b3402f', fontWeight: 600, fontFamily: 'monospace' }}>{r.salto}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#b0740f' }}>{r.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
