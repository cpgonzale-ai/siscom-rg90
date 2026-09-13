import React from 'react';
import { ListTree } from 'lucide-react';
import { stickyTheadStyle, scrollableGridStyle } from '../components/Modal';

interface CorrelatividadViewProps {
  correlatividad: any[];
  correlFiltro: string;
  correlFilterStyleTodos: string;
  correlFilterStyleAloha: string;
  correlFilterStyleHiopos: string;
  setCorrelTodos: () => void;
  setCorrelAloha: () => void;
  setCorrelHiopos: () => void;
}

export const CorrelatividadView: React.FC<CorrelatividadViewProps> = ({
  correlatividad,
  correlFilterStyleTodos,
  correlFilterStyleAloha,
  correlFilterStyleHiopos,
  setCorrelTodos,
  setCorrelAloha,
  setCorrelHiopos,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e0da',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListTree size={22} color="#128752" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>
              Control de Correlatividad de Numeración
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: '#5c6470', marginTop: '4px' }}>
            Saltos de numeración detectados automáticamente por punto de expedición en los libros propios
          </p>
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={setCorrelTodos} style={parseInlineStyle(correlFilterStyleTodos)}>
            Todos
          </button>
          <button onClick={setCorrelAloha} style={parseInlineStyle(correlFilterStyleAloha)}>
            Aloha
          </button>
          <button onClick={setCorrelHiopos} style={parseInlineStyle(correlFilterStyleHiopos)}>
            Hiopos
          </button>
        </div>
      </div>

      {/* Correlatividad Table */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={scrollableGridStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
              <th style={{ ...stickyTheadStyle, backgroundColor: '#fafbfa', padding: '14px 16px', fontWeight: 600 }}>Local / Establecimiento</th>
              <th style={{ ...stickyTheadStyle, backgroundColor: '#fafbfa', padding: '14px 16px', fontWeight: 600 }}>Sistema</th>
              <th style={{ ...stickyTheadStyle, backgroundColor: '#fafbfa', padding: '14px 16px', fontWeight: 600 }}>Tipo</th>
              <th style={{ ...stickyTheadStyle, backgroundColor: '#fafbfa', padding: '14px 16px', fontWeight: 600 }}>Último N° Procesado</th>
              <th style={{ ...stickyTheadStyle, backgroundColor: '#fafbfa', padding: '14px 16px', fontWeight: 600 }}>Salto Detectado</th>
              <th style={{ ...stickyTheadStyle, backgroundColor: '#fafbfa', padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Faltantes</th>
              <th style={{ ...stickyTheadStyle, backgroundColor: '#fafbfa', padding: '14px 16px', fontWeight: 600 }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {correlatividad.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                <td style={{ padding: '14px 16px', fontWeight: 600, color: '#22262b' }}>{r.local}</td>
                <td style={{ padding: '14px 16px', color: '#5c6470' }}>{r.sistema}</td>
                <td style={{ padding: '14px 16px' }}>
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
                <td style={{ padding: '14px 16px', color: '#5c6470', fontFamily: 'monospace' }}>{r.ultimo}</td>
                <td style={{ padding: '14px 16px', color: '#b3402f', fontWeight: 600, fontFamily: 'monospace' }}>
                  {r.salto}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, color: '#b0740f' }}>
                  {r.cantidad}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span
                    style={{
                      backgroundColor: '#fdf1de',
                      color: '#b0740f',
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
          </tbody>
        </table>
        </div>
      </div>
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
