import React from 'react';
import { LayoutDashboard, FileSpreadsheet, ShoppingCart, MapPin, Users, KeyRound, ArrowRight } from 'lucide-react';
// Marca de agua de fondo de esta pantalla — para cambiarla por otro logo, reemplazá este
// import (o el archivo en esa ruta) por la imagen que corresponda.
import logoWatermark from '../assets/logo-consultora-san-miguel.png';

type Screen = 'dashboard' | 'carga' | 'compras' | 'locales' | 'usuarios' | 'roles';

interface InicioViewProps {
  nombreUsuario?: string;
  permisos: Set<string>;
  onNavigate: (screen: Screen) => void;
}

interface Opcion {
  screen: Screen;
  permiso: string;
  icon: React.ReactNode;
  titulo: string;
  desc: string;
}

// Los dos asistentes de conciliación son el uso principal del sistema — van como "hero
// cards" grandes arriba. El resto (consulta ocasional / administración) va abajo, agrupado
// y compacto.
const PRINCIPALES: Opcion[] = [
  { screen: 'carga', permiso: 'pantalla:carga', icon: <FileSpreadsheet size={26} />, titulo: 'Libro Ventas vs RG90', desc: 'Cargar, convertir y comparar el libro de ventas' },
  { screen: 'compras', permiso: 'pantalla:compras', icon: <ShoppingCart size={26} />, titulo: 'Libro compras vs RG90', desc: 'Cargar, convertir y comparar el libro de compras' },
];

const SECUNDARIOS: Opcion[] = [
  { screen: 'dashboard', permiso: 'pantalla:dashboard', icon: <LayoutDashboard size={18} />, titulo: 'Panel general', desc: 'Estado del flujo y totales cargados' },
  { screen: 'locales', permiso: 'pantalla:locales', icon: <MapPin size={18} />, titulo: 'Locales', desc: 'Alta, edición y baja de locales' },
  { screen: 'usuarios', permiso: 'pantalla:usuarios', icon: <Users size={18} />, titulo: 'Usuarios', desc: 'Alta, edición y baja de usuarios' },
  { screen: 'roles', permiso: 'pantalla:roles', icon: <KeyRound size={18} />, titulo: 'Roles y permisos', desc: 'Qué puede usar cada rol' },
];

export const InicioView: React.FC<InicioViewProps> = ({ nombreUsuario, permisos, onNavigate }) => {
  const principales = PRINCIPALES.filter(op => permisos.has(op.permiso));
  const secundarios = SECUNDARIOS.filter(op => permisos.has(op.permiso));
  const sinNada = principales.length === 0 && secundarios.length === 0;

  return (
    <div className="inicio-wrap">
      {/* Marca de agua: ahora desplazada a la esquina inferior derecha (ver
          .inicio-watermark en index.css) en vez de centrada — así queda "detrás" del
          espacio libre que dejan las hero cards, sin que ningún botón le pase por encima.
          Puramente decorativa: pointer-events none, nunca intercepta clicks. */}
      <div className="inicio-watermark" aria-hidden="true">
        <img src={logoWatermark} alt="" />
      </div>

      <div className="inicio-content" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div>
          <h3 style={{ fontSize: '28px', fontWeight: 800, color: '#0e6b41', letterSpacing: '-0.02em' }}>
            {nombreUsuario ? `Hola, ${nombreUsuario}` : 'Bienvenido/a'}
          </h3>
          <p style={{ fontSize: '13.5px', color: '#5c6470', marginTop: '4px' }}>
            Elegí a dónde querés ir — estas son las pantallas habilitadas para tu rol.
          </p>
        </div>

        {sinNada ? (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', padding: '24px', color: '#5c6470', fontSize: '13.5px' }}>
            Tu usuario no tiene ninguna pantalla habilitada todavía. Consultá con tu administrador.
          </div>
        ) : (
          <>
            {/* Módulos principales — hero cards */}
            {principales.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {principales.map(op => (
                  <button
                    key={op.screen}
                    onClick={() => onNavigate(op.screen)}
                    className="inicio-card inicio-card--hero"
                    style={{
                      // El fondo blanco, la sombra y el borde superior/derecho/inferior
                      // los pone .inicio-card; el borde lateral grueso de acento lo pone
                      // .inicio-card--hero (ver index.css) — layout nada más acá.
                      padding: '28px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '18px',
                    }}
                  >
                    <div
                      style={{
                        width: '56px', height: '56px', borderRadius: '14px',
                        backgroundColor: '#e8f3ec', color: '#128752',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {op.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '19px', fontWeight: 800, color: '#22262b' }}>{op.titulo}</div>
                      <div style={{ fontSize: '13px', color: '#5c6470', marginTop: '6px', lineHeight: 1.4 }}>{op.desc}</div>
                    </div>
                    {/* Estilo "pill" + animación de la flecha al pasar el mouse por toda la
                        tarjeta — definidos en .inicio-hero-cta / .inicio-hero-cta-arrow
                        (index.css), activados por el :hover del <button> padre. */}
                    <div className="inicio-hero-cta" style={{ marginTop: 'auto' }}>
                      <span>Ir</span>
                      <span className="inicio-hero-cta-arrow">
                        <ArrowRight size={15} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Módulos secundarios — administración y configuración, compactos */}
            {secundarios.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9aa1ab', fontWeight: 700, marginBottom: '10px' }}>
                  Administración y configuración
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {secundarios.map(op => (
                    <button
                      key={op.screen}
                      onClick={() => onNavigate(op.screen)}
                      className="inicio-card"
                      style={{
                        padding: '14px 16px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          width: '32px', height: '32px', borderRadius: '9px', flex: 'none',
                          backgroundColor: '#e8f3ec', color: '#128752',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {op.icon}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#22262b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{op.titulo}</div>
                        <div style={{ fontSize: '11px', color: '#9aa1ab', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{op.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
