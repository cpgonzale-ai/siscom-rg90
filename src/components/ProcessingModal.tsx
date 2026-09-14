import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ProcessingModalProps {
  message?: string;
  // Si viene con contenido, el modal deja de mostrar el spinner y pasa a mostrar este error
  // en su lugar — mismo modal, no uno nuevo (ej. "el archivo no tiene el formato
  // correcto"). Requiere onClose: a diferencia del estado de carga, acá sí hace falta una
  // forma de cerrarlo, porque ya no hay ninguna operación en curso esperando a terminar.
  error?: string | null;
  onClose?: () => void;
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
  maxWidth: '420px',
};

// Overlay bloqueante genérico: se muestra mientras el sistema está procesando (convertir,
// analizar, comparar) en cualquier paso de Ventas o Compras. A diferencia de Modal/
// ConfirmModal, mientras está "cargando" no tiene botón de cerrar ni se cierra al hacer clic
// afuera — mientras esté montado, cubre toda la pantalla con un z-index más alto que
// cualquier otro modal, así que no queda nada debajo con lo que se pueda interactuar hasta
// que la operación termine. Si esa operación termina en error (ej. el archivo adjuntado no
// tiene el formato correcto), el mismo modal pasa a mostrar el error en vez de desaparecer
// silenciosamente para dejarlo solo en el cartel chico debajo del formulario — así el
// usuario lo ve antes de seguir.
export const ProcessingModal: React.FC<ProcessingModalProps> = ({ message = 'Procesando…', error, onClose }) => {
  if (error) {
    return (
      <div style={overlayStyle}>
        <div style={boxStyle}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#fbe9e3',
              color: '#b3402f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <p style={{ fontSize: '13.5px', color: '#5c6470', lineHeight: 1.5, textAlign: 'center' }}>
            {error}
          </p>
          <button
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e0da',
              color: '#5c6470',
              borderRadius: '7px',
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...overlayStyle, cursor: 'wait' }}>
      <div style={boxStyle}>
        <Loader2 size={32} color="#128752" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#22262b', textAlign: 'center' }}>
          {message}
        </p>
      </div>
    </div>
  );
};
