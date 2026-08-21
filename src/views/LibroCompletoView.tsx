import React from 'react';
import { ArrowLeft, Search, Download } from 'lucide-react';
import type { LibroRow } from '../services/api';

interface LibroCompletoViewProps {
  rows: LibroRow[];
  totalSinFiltrar: number;
  search: string;
  onSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolver: () => void;
  onDownload: () => void;
}

// Pantalla dedicada a "Ver todos": muestra el libro de ventas completo, sin recortar
// por paginado, para cuando el usuario necesita revisar o buscar sobre la totalidad
// de los comprobantes cargados (no solo las primeras 20 filas del Paso 2).
export const LibroCompletoView: React.FC<LibroCompletoViewProps> = ({
  rows,
  totalSinFiltrar,
  search,
  onSearch,
  onVolver,
  onDownload,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e0da',
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onVolver}
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
            <ArrowLeft size={14} />
            <span>Volver</span>
          </button>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>
              Libro de Ventas — Todos los registros
            </h3>
            <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
              Mostrando {rows.length} de {totalSinFiltrar} comprobantes cargados
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="#9aa1ab" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por doc, RUC, cliente, local..."
              value={search}
              onChange={onSearch}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                border: '1px solid #e2e0da',
                borderRadius: '7px',
                fontSize: '12.5px',
                backgroundColor: '#ffffff',
              }}
            />
          </div>
          <button
            onClick={onDownload}
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

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ maxHeight: '75vh', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470', position: 'sticky', top: 0 }}>
                <th style={{ padding: '12px 14px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Documento</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Tipo</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Sistema</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Local</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Fecha</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, backgroundColor: '#fafbfa' }}>RUC</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Nombre</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', backgroundColor: '#fafbfa' }}>Gravadas 10%</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', backgroundColor: '#fafbfa' }}>IVA 10%</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', backgroundColor: '#fafbfa' }}>Gravadas 5%</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', backgroundColor: '#fafbfa' }}>IVA 5%</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', backgroundColor: '#fafbfa' }}>Exentas</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'right', backgroundColor: '#fafbfa' }}>Total</th>
                <th style={{ padding: '12px 14px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#22262b', whiteSpace: 'nowrap' }}>{r.doc}</td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
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
                  <td style={{ padding: '10px 14px', color: '#5c6470', whiteSpace: 'nowrap' }}>{r.sistema}</td>
                  <td style={{ padding: '10px 14px', color: '#5c6470', whiteSpace: 'nowrap' }}>{r.local}</td>
                  <td style={{ padding: '10px 14px', color: '#5c6470', whiteSpace: 'nowrap' }}>{r.fecha}</td>
                  <td style={{ padding: '10px 14px', color: '#5c6470', whiteSpace: 'nowrap' }}>{r.ruc}</td>
                  <td style={{ padding: '10px 14px', color: '#22262b', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.nombre}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.gravadas_5 ?? '0'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.iva_5 ?? '0'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#5c6470' }}>{r.exentas}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#22262b' }}>{r.total}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        background: r.estado === 'Anulada' ? '#fbe9e3' : '#e8f3ec',
                        color: r.estado === 'Anulada' ? '#b3402f' : '#128752',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '20px',
                      }}
                    >
                      {r.estado}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={14} style={{ padding: '32px', textAlign: 'center', color: '#9aa1ab' }}>
                    No hay comprobantes que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
