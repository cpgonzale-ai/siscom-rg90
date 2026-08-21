import React from 'react';
import { LayoutDashboard, FileSpreadsheet, ListTree, GitCompare, ShieldCheck, MapPin, Users, KeyRound } from 'lucide-react';
import logoConsultora from '../assets/logo-consultora-san-miguel.png';

type Screen = 'dashboard' | 'carga' | 'correl' | 'rg90' | 'libroCompleto' | 'locales' | 'usuarios' | 'roles';

interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: 'dashboard' | 'carga' | 'correl' | 'rg90' | 'locales' | 'usuarios' | 'roles') => void;
  permisos: Set<string>;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, onNavigate, permisos }) => {
  const navItemStyle = (screen: string) => {
    const isActive = currentScreen === screen;
    return {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      textAlign: 'left' as const,
      width: '100%',
      border: 'none',
      background: isActive ? '#ffffff' : 'transparent',
      color: isActive ? '#0e6b41' : 'rgba(255, 255, 255, 0.88)',
      fontSize: '13.5px',
      fontWeight: isActive ? 700 : 500,
      padding: '10px 12px',
      borderRadius: '7px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.15s ease',
      boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.15)' : 'none',
    };
  };

  const dotStyle = (screen: string) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: currentScreen === screen ? '#f0a63d' : 'rgba(255, 255, 255, 0.5)',
    flex: 'none',
  });

  const puede = (clave: string) => permisos.has(clave);
  const puedeAdmin = puede('pantalla:locales') || puede('pantalla:usuarios') || puede('pantalla:roles');

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: '#0e6b41',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 100,
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        overflowY: 'auto',
      }}
    >
      {/* Brand Header */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <img src={logoConsultora} alt="Consultora San Miguel" style={{ height: '48px', width: 'auto', display: 'block' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <ShieldCheck size={26} color="#f0a63d" />
          <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
            SISCOM <span style={{ color: '#f0a63d' }}>RG90</span>
          </h1>
        </div>
        <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>
          Consultora San Miguel · CORVIS PY
        </p>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', margin: '0 8px 8px 8px', fontWeight: 600 }}>
          Módulos de Conciliación
        </div>

        {puede('pantalla:dashboard') && (
          <button style={navItemStyle('dashboard')} onClick={() => onNavigate('dashboard')}>
            <div style={dotStyle('dashboard')} />
            <LayoutDashboard size={17} />
            <span>Panel general</span>
          </button>
        )}

        {puede('pantalla:carga') && (
          <button style={navItemStyle('carga')} onClick={() => onNavigate('carga')}>
            <div style={dotStyle('carga')} />
            <FileSpreadsheet size={17} />
            <span>Carga y libro de ventas</span>
          </button>
        )}

        {puede('pantalla:correlatividad') && (
          <button style={navItemStyle('correl')} onClick={() => onNavigate('correl')}>
            <div style={dotStyle('correl')} />
            <ListTree size={17} />
            <span>Control de correlatividad</span>
          </button>
        )}

        {puede('pantalla:rg90') && (
          <button style={navItemStyle('rg90')} onClick={() => onNavigate('rg90')}>
            <div style={dotStyle('rg90')} />
            <GitCompare size={17} />
            <span>Comparación contra RG90</span>
          </button>
        )}

        {puedeAdmin && (
          <>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', margin: '16px 8px 8px 8px', fontWeight: 600 }}>
              Administración
            </div>
            {puede('pantalla:locales') && (
              <button style={navItemStyle('locales')} onClick={() => onNavigate('locales')}>
                <div style={dotStyle('locales')} />
                <MapPin size={17} />
                <span>Locales</span>
              </button>
            )}
            {puede('pantalla:usuarios') && (
              <button style={navItemStyle('usuarios')} onClick={() => onNavigate('usuarios')}>
                <div style={dotStyle('usuarios')} />
                <Users size={17} />
                <span>Usuarios</span>
              </button>
            )}
            {puede('pantalla:roles') && (
              <button style={navItemStyle('roles')} onClick={() => onNavigate('roles')}>
                <div style={dotStyle('roles')} />
                <KeyRound size={17} />
                <span>Roles y permisos</span>
              </button>
            )}
          </>
        )}
      </nav>

      {/* Footer Info */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '11.5px', color: 'rgba(255,255,255,0.6)' }}>
        <div>Empresa: <strong>ACDG S.A.</strong></div>
        <div>Periodo: <strong>Mayo 2026</strong></div>
        <div style={{ marginTop: '4px', fontSize: '10.5px', color: '#f0a63d' }}>
          ● Motor Fiscal Activo v1.0
        </div>
      </div>
    </aside>
  );
};
