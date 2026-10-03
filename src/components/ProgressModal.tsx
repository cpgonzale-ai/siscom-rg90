import React from 'react';

interface ProgressModalProps {
  message: string;
  // 0-100. Ver utils/progreso.ts: combina progreso real de subida con un avance simulado
  // acotado para la espera de la respuesta del servidor -- nunca llega a 100 por sí solo,
  // el caller lo fuerza a 100 recién cuando el proceso realmente termina.
  percent: number;
  // Total aproximado de registros (ver contarFilasAproximado) -- si no se pudo calcular
  // (0/undefined), se omite el texto "Procesados: X de Y" y se muestra solo el porcentaje.
  total?: number;
  // Si se pasa, se muestra un botón "Cancelar" que aborta la operación en curso (ver
  // cancelarOperacionEnCurso en utils/progreso.ts). Sin esto, el modal no tiene salida.
  onCancel?: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  cursor: 'wait',
};

const boxStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '32px 40px',
  boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
  border: '1px solid #e2e0da',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
  maxWidth: '440px',
  width: '92%',
};

// Overlay bloqueante con barra de progreso, para los dos momentos en que se lee/analiza un
// Excel grande (Libro al convertir, RG90 al adjuntar) -- ver doConvert/handleRg90FileUpload
// en App.tsx y utils/progreso.ts para de dónde sale `percent`. Mismo criterio de bloqueo que
// ProcessingModal (sin botón de cerrar, z-index alto: nada de la pantalla siguiente puede
// quedar visible detrás mientras esto está montado) -- la diferencia es que acá el avance es
// visible en vez de un spinner indefinido.
export const ProgressModal: React.FC<ProgressModalProps> = ({ message, percent, total, onCancel }) => {
  // Bug real corregido acá: el avance simulado (ver ejecutarConAvance, utils/progreso.ts)
  // se acerca asintóticamente a ~99,7% mientras se espera la respuesta del servidor --
  // Math.round por sí solo redondeaba eso a "100%" mucho ANTES de que el proceso terminara
  // de verdad (para archivos grandes, con el servidor todavía trabajando varios segundos o
  // minutos más), dando la falsa impresión de que ya había terminado. Se muestra 100%
  // ÚNICAMENTE cuando el caller lo pone en 100 de verdad (recién con la respuesta real ya
  // recibida) -- cualquier valor menor, aunque redondee a 100, se topea en 99.
  const pctRedondeado = Math.round(percent);
  const pct = percent >= 100 ? 100 : Math.max(0, Math.min(99, pctRedondeado));
  const procesados = total ? Math.min(total, Math.round((pct / 100) * total)) : undefined;

  return (
    <div style={overlayStyle}>
      <div style={boxStyle}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#22262b', textAlign: 'center', margin: 0 }}>
          {message}
        </p>
        <div style={{ width: '100%' }}>
          <div
            style={{
              width: '100%',
              height: '10px',
              borderRadius: '999px',
              backgroundColor: '#e2e0da',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, #128752, #1ea968)',
                transition: 'width 200ms ease-out',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '8px' }}>
            <span style={{ fontSize: '12.5px', color: '#5c6470' }}>
              {total && procesados !== undefined
                ? `Procesados: ${procesados.toLocaleString('es-PY')} de ${total.toLocaleString('es-PY')} registros`
                : ''}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#128752' }}>{pct}%</span>
          </div>
          {onCancel && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '14px' }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  background: 'transparent',
                  border: '1px solid #d6d3cb',
                  borderRadius: '8px',
                  padding: '7px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#5c6470',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
