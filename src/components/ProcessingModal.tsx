import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingModalProps {
  message?: string;
}

// Overlay bloqueante genérico: se muestra mientras el sistema está procesando (convertir,
// analizar, comparar) en cualquier paso de Ventas o Compras. A diferencia de Modal/
// ConfirmModal, no tiene botón de cerrar ni se cierra al hacer clic afuera — mientras esté
// montado, cubre toda la pantalla con un z-index más alto que cualquier otro modal, así que
// no queda nada debajo con lo que se pueda interactuar hasta que la operación termine.
export const ProcessingModal: React.FC<ProcessingModalProps> = ({ message = 'Procesando…' }) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        cursor: 'wait',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '32px 44px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
          border: '1px solid #e2e0da',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <Loader2 size={32} color="#128752" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#22262b', textAlign: 'center' }}>
          {message}
        </p>
      </div>
    </div>
  );
};
