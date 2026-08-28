import React, { useState } from 'react';
import { ExcelFilterHeader } from './ExcelFilterHeader';
import { secondaryBtnStyle } from './Modal';

const SALTOS_COLUMNAS: { key: string; label: string; getValue: (r: any) => string }[] = [
  { key: 'local', label: 'Local / Establecimiento', getValue: r => r.local },
  { key: 'sistema', label: 'Sistema', getValue: r => r.sistema },
  { key: 'tipo_doc', label: 'Tipo', getValue: r => r.tipo_doc || 'Factura' },
  { key: 'ultimo', label: 'Último N° Procesado', getValue: r => r.ultimo },
  { key: 'salto', label: 'Salto Detectado', getValue: r => r.salto },
  { key: 'cantidad', label: 'Faltantes', getValue: r => String(r.cantidad) },
];

// Tabla de saltos de numeración — se usa en el modal del Paso 2 de Ventas (CargaView, solo
// libro propio), el del Paso 3 (RG90View, solo RG90) y el del Paso 4 (RG90View, combinado
// libro + RG90 con columna "Origen"). Maneja su propio filtro por columna: se resetea solo
// al cerrar el modal, porque el componente se desmonta junto con él.
export const TablaSaltos: React.FC<{ rows: any[]; conOrigen?: boolean }> = ({ rows, conOrigen }) => {
  const [colFiltros, setColFiltros] = useState<Record<string, Set<string> | null>>({});
  const columnas = conOrigen
    ? [{ key: 'origen', label: 'Origen', getValue: (r: any) => r.__origen }, ...SALTOS_COLUMNAS]
    : SALTOS_COLUMNAS;
  let filteredRows = rows;
  for (const col of columnas) {
    const activo = colFiltros[col.key];
    if (activo) filteredRows = filteredRows.filter(r => activo.has(col.getValue(r)));
  }
  const hayFiltrosActivos = Object.values(colFiltros).some(v => v !== null && v !== undefined);

  return (
    <div>
      {hayFiltrosActivos && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button onClick={() => setColFiltros({})} style={{ ...secondaryBtnStyle, padding: '6px 10px', fontSize: '11.5px' }}>
            Limpiar filtros
          </button>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
              {columnas.map(col => (
                <th key={col.key} style={{ padding: '10px 12px', fontWeight: 600, textAlign: col.key === 'cantidad' ? 'center' : 'left' }}>
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
