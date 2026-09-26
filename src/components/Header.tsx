import React from 'react';
import { Menu, ArrowLeft } from 'lucide-react';

/** Subconjunto de MeInfo (services/api.ts) que el Header necesita — se acepta `null` porque
    el usuario tarda un tick en llegar desde /api/auth/me al recargar la página. */
interface HeaderUsuario {
  nombre?: string;
  nro_documento?: string;
  rol?: string;
}

interface HeaderProps {
  title: string;
  subtitle: string;
  onLogout?: () => void;
  /** Abre/cierra el sidebar — el estado en sí vive en App (arranca siempre cerrado). */
  onToggleSidebar: () => void;
  /** "← Volver": deshabilitado (no se muestra el botón) pasando `undefined`. App decide
      cuándo hay a dónde volver y oculta el botón en la pantalla de Inicio. */
  onGoBack?: () => void;
  /** Usuario autenticado real (App.tsx lo trae de getMeApi()/`/api/auth/me`) — reemplaza el
      texto fijo que había acá antes. Nota: el modelo de datos del sistema es de un solo
      cliente (no hay "empresa" ni "RUC" por usuario en la base — ver app/db/models.py,
      tabla `usuarios`), así que no hay un campo real para el RUC que mostraba el diseño
      anterior; se muestra el documento del usuario en su lugar. */
  usuario?: HeaderUsuario | null;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onLogout, onToggleSidebar, onGoBack, usuario }) => {
  // Iniciales para el avatar circular, a partir del nombre real — máximo 2 letras (primera
  // palabra + segunda palabra, ej. "Cynthia González" -> "CG"). Sin nombre todavía (usuario
  // null/undefined mientras carga /api/auth/me) cae a un genérico, nunca revienta el render.
  const iniciales = (usuario?.nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || '—';

  return (
    <header
      style={{
        height: '70px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e0da',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 90,
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <button
          onClick={onToggleSidebar}
          aria-label="Abrir menú"
          style={{
            background: 'transparent',
            border: '1px solid #e2e0da',
            borderRadius: '6px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#22262b',
            flex: 'none',
          }}
        >
          <Menu size={19} />
        </button>
        <div style={{ minWidth: 0 }}>
          {onGoBack && (
            <button
              onClick={onGoBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: 'none',
                padding: 0,
                marginBottom: '2px',
                color: '#5c6470',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={13} />
              <span>Volver</span>
            </button>
          )}
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#22262b', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </h2>
          <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Se oculta en pantallas angostas (ver .header-company-info en index.css) — con el
            sidebar cerrado por defecto el header ya compite por espacio con el título. */}
        <div className="header-company-info" style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#22262b' }}>{usuario?.nombre ?? 'Cargando…'}</div>
          <div style={{ fontSize: '11px', color: '#5c6470' }}>
            {usuario?.rol ? `${usuario.rol.charAt(0).toUpperCase()}${usuario.rol.slice(1)}` : ''}
            {usuario?.rol && usuario?.nro_documento ? ' · ' : ''}
            {usuario?.nro_documento ? `Doc. ${usuario.nro_documento}` : ''}
          </div>
        </div>
        <div
          title={usuario?.nombre}
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
            flex: 'none',
          }}
        >
          {iniciales}
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
