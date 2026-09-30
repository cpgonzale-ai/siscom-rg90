import React, { useState } from 'react';
import { Home, LayoutDashboard, FileSpreadsheet, ShieldCheck, MapPin, Users, KeyRound, ChevronDown, ChevronRight, ShoppingCart, X } from 'lucide-react';
import logoConsultora from '../assets/logo-consultora-san-miguel.png';

type Screen = 'inicio' | 'dashboard' | 'carga' | 'correl' | 'rg90' | 'libroCompleto' | 'compras' | 'locales' | 'usuarios' | 'roles';

interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: 'inicio' | 'dashboard' | 'carga' | 'correl' | 'rg90' | 'compras' | 'locales' | 'usuarios' | 'roles') => void;
  permisos: Set<string>;
  /** Colapsado por defecto: el padre controla la visibilidad (arranca en `false`). */
  open: boolean;
  /** Se dispara al tocar el backdrop o la X — el padre decide cerrar. */
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, onNavigate, permisos, open, onClose }) => {
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
  const estaEnAdmin = currentScreen === 'locales' || currentScreen === 'usuarios' || currentScreen === 'roles';
  // Los submenús (hoy solo "Administración") arrancan colapsados por defecto — se abren al
  // tocarlos, o automáticamente si ya estás parado en una de sus pantallas.
  const [adminAbierto, setAdminAbierto] = useState(estaEnAdmin);

  return (
    <>
      {/* Backdrop: solo existe (y solo intercepta clicks) mientras el menú está abierto —
          tocar afuera del panel lo cierra, igual en mobile y en desktop. */}
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 20, 0.35)',
            zIndex: 99,
            animation: 'fadeIn 0.15s ease-out',
          }}
        />
      )}

      <aside
        role="navigation"
        aria-label="Menú principal"
        aria-hidden={!open}
        style={{
          width: '260px',
          maxWidth: '85vw',
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
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
        }}
      >
      {/* Brand Header */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={26} color="#f0a63d" />
          <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
            SISCOM <span style={{ color: '#f0a63d' }}>RG90</span>
          </h1>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        {/* Sin gate de permiso a propósito: es solo un launcher hacia lo que cada rol ya
            tiene habilitado, nunca muestra nada que el usuario no pueda abrir. */}
        <button style={navItemStyle('inicio')} onClick={() => onNavigate('inicio')}>
          <div style={dotStyle('inicio')} />
          <Home size={17} />
          <span>Inicio</span>
        </button>

        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', margin: '12px 8px 8px 8px', fontWeight: 600 }}>
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
            <span>Libro Ventas vs RG90</span>
          </button>
        )}

        {/* Control de correlatividad y Comparación contra RG90 se ocultan del menú — siguen
            existiendo como pantallas (se llega por los botones "Siguiente" del wizard de
            Libro de Ventas y por el modal de saltos del Paso 2), solo se saca el acceso
            directo acá. */}

        {puede('pantalla:compras') && (
          <button style={navItemStyle('compras')} onClick={() => onNavigate('compras')}>
            <div style={dotStyle('compras')} />
            <ShoppingCart size={17} />
            <span>Libro compras vs RG90</span>
          </button>
        )}

        {puedeAdmin && (
          <>
            <button
              onClick={() => setAdminAbierto(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: 'inherit', padding: '0 8px', margin: '16px 0 8px 0',
              }}
            >
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                Administración
              </span>
              {adminAbierto ? <ChevronDown size={14} color="rgba(255,255,255,0.5)" /> : <ChevronRight size={14} color="rgba(255,255,255,0.5)" />}
            </button>
            {adminAbierto && (
              <>
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
          </>
        )}
      </nav>

      {/* Footer Info */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
        Desarrollado por CORVISPY v.1.0
      </div>
      </aside>
    </>
  );
};
