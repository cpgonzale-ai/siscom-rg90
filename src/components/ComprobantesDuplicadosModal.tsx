import React, { useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { Modal, scrollableGridStyle, stickyTheadStyle, excelBtnStyle } from './Modal';
import { exportarTablaExcelApi, type ComprobantesDuplicadosError } from '../services/api';

// Presentación del error de comprobantes duplicados (ver ReconcileDuplicadosError,
// services/api.ts) — misma validación de siempre del lado del backend
// (_insertar_lote_diagnosticando_duplicados, main.py), esto solo la muestra en una grilla
// ordenada en vez de un párrafo con solo 5 ejemplos truncados. Se lista TODO el detalle que
// mande el backend, sin cortar, aunque sean cientos de filas — por eso la tabla de detalle
// scrollea en vez de crecer sin límite.
export const ComprobantesDuplicadosModal: React.FC<{
  error: ComprobantesDuplicadosError;
  onClose: () => void;
}> = ({ error, onClose }) => {
  const totalResumen = error.resumen.reduce((s, r) => s + r.cantidad, 0);
  const [descargando, setDescargando] = useState(false);

  // Exporta TODO error.detalle (ya viene completo, sin truncar -- ver el comentario de
  // arriba) a un Excel, usando los mismos resultados de la validación que ya se corrió: no
  // vuelve a llamar a ningún endpoint de validación ni recalcula nada. Nombre de archivo
  // según el origen para que quede claro de cuál de los dos archivos son los duplicados.
  const descargarDuplicados = async () => {
    setDescargando(true);
    try {
      await exportarTablaExcelApi(
        `Duplicados_${error.origen}.xlsx`,
        'Duplicados',
        ['N.º', 'Comprobante', 'Tipo', 'Cantidad de apariciones', 'Origen'],
        error.detalle.map((d, i) => [String(i + 1), d.comprobante, d.tipo, String(d.cantidad), d.origen]),
      );
    } catch (e) {
      console.error('Error al exportar los comprobantes duplicados a Excel:', e);
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Modal title={error.titulo} onClose={onClose} width="760px">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
        <div
          style={{
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            backgroundColor: '#fbe9e3', color: '#b3402f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <AlertTriangle size={18} />
        </div>
        <p style={{ fontSize: '13.5px', color: '#5c6470', lineHeight: 1.5, margin: 0 }}>{error.mensaje}</p>
      </div>

      <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#22262b', marginBottom: '10px' }}>Resumen de duplicados</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginBottom: '24px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Origen</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>Cantidad de comprobantes duplicados</th>
          </tr>
        </thead>
        <tbody>
          {error.resumen.map(r => (
            <tr key={r.origen} style={{ borderBottom: '1px solid #f0eee8' }}>
              <td style={{ padding: '8px 10px', color: '#5c6470' }}>{r.origen}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#22262b' }}>{r.cantidad.toLocaleString('es-PY')}</td>
            </tr>
          ))}
          <tr>
            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#22262b' }}>Total</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#22262b' }}>{totalResumen.toLocaleString('es-PY')}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#22262b', margin: 0 }}>
          Detalle de comprobantes duplicados ({error.detalle.length.toLocaleString('es-PY')})
        </h4>
        {error.detalle.length > 0 && (
          <button
            onClick={descargarDuplicados}
            disabled={descargando}
            style={{ ...excelBtnStyle, padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', ...(descargando ? { opacity: 0.7, cursor: 'wait' } : {}) }}
          >
            <Download size={14} />
            <span>{descargando ? 'Generando Excel…' : 'Excel'}</span>
          </button>
        )}
      </div>
      <div style={scrollableGridStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
              <th style={{ ...stickyTheadStyle, padding: '8px 10px', fontWeight: 600 }}>N.º</th>
              <th style={{ ...stickyTheadStyle, padding: '8px 10px', fontWeight: 600 }}>Comprobante</th>
              <th style={{ ...stickyTheadStyle, padding: '8px 10px', fontWeight: 600 }}>Tipo</th>
              <th style={{ ...stickyTheadStyle, padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Cantidad de apariciones</th>
              <th style={{ ...stickyTheadStyle, padding: '8px 10px', fontWeight: 600 }}>Origen</th>
            </tr>
          </thead>
          <tbody>
            {error.detalle.map((d, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                <td style={{ padding: '8px 10px', color: '#9aa1ab' }}>{i + 1}</td>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: '#22262b', fontFamily: 'monospace' }}>{d.comprobante}</td>
                <td style={{ padding: '8px 10px', color: '#5c6470' }}>{d.tipo}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#b3402f' }}>{d.cantidad}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span
                    style={{
                      background: d.origen === 'Libro' ? '#e8f3ec' : '#eef2fb',
                      color: d.origen === 'Libro' ? '#128752' : '#2f5fa8',
                      fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px',
                    }}
                  >
                    {d.origen}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error.aclaracion && (
        <p style={{ fontSize: '12.5px', color: '#5c6470', lineHeight: 1.5, marginTop: '20px', whiteSpace: 'pre-line' }}>
          {error.aclaracion}
        </p>
      )}
    </Modal>
  );
};
