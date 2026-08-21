import React from 'react';

interface HeaderProps {
  title: string;
  subtitle: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onLogout }) => {
  return (
    <header
      style={{
        height: '70px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e0da',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        position: 'sticky',
        top: 0,
        zIndex: 90,
      }}
    >
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#22262b', lineHeight: 1.2 }}>
          {title}
        </h2>
        <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
          {subtitle}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#22262b' }}>AC DESARROLLOS GASTRONOMICOS</div>
          <div style={{ fontSize: '11px', color: '#5c6470' }}>RUC: 80075922-2</div>
        </div>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#e8f3ec',
            color: '#128752',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #cfd6d0',
          }}
        >
          CSM
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              background: '#fff',
              border: '1px solid #e2e0da',
              color: '#5c6470',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cerrar sesión
          </button>
        )}
      </div>
    </header>
  );
};
