import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

// Cascarón genérico para modales de formulario (crear/editar) — comparte look & feel con
// ConfirmModal pero deja el contenido a cargo de cada pantalla que lo use.
export const Modal: React.FC<ModalProps> = ({ title, onClose, children, width = '480px' }) => {
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
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: width,
          width: '92%',
          maxHeight: '86vh',
          overflowY: 'auto',
          boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
          border: '1px solid #e2e0da',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#9aa1ab',
          }}
        >
          <X size={18} />
        </button>

        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b', marginBottom: '18px' }}>{title}</h3>

        {children}
      </div>
    </div>
  );
};

export const fieldLabelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#5c6470', marginBottom: '5px', display: 'block' };
export const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #e2e0da',
  borderRadius: '7px',
  fontSize: '13px',
  color: '#22262b',
  marginBottom: '14px',
  boxSizing: 'border-box',
};
export const primaryBtnStyle: React.CSSProperties = {
  background: '#f0a63d', color: '#1a1a1a', border: 'none', borderRadius: '7px',
  padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
};
export const secondaryBtnStyle: React.CSSProperties = {
  background: '#fff', color: '#5c6470', border: '1px solid #e2e0da', borderRadius: '7px',
  padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};
export const dangerBtnStyle: React.CSSProperties = {
  background: '#fff', color: '#b3402f', border: '1px solid #f0c9be', borderRadius: '7px',
  padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};

// Fila de navegación (Volver / Siguiente) que usan los tres wizards (Libro Ventas, RG90,
// Libro Compras) arriba de cada paso — antes vivía triplicada, definida igual en cada vista.
export const navRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
export const disabledBtnStyle: React.CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };
