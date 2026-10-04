import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ConfirmModal } from './components/ConfirmModal';
import { ErrorBoundary } from './components/ErrorBoundary';

import { InicioView } from './views/InicioView';
import { LoginView } from './views/LoginView';
import { ComprasView } from './views/ComprasView';
import { LocalesView } from './views/LocalesView';
import { UsuariosView } from './views/UsuariosView';
import { RolesView } from './views/RolesView';
import { idbDelete, VENTAS_PERSIST_KEY, COMPRAS_PERSIST_KEY } from './utils/persistStore';
import { useAdministracion } from './hooks/useAdministracion';
import { VentasProvider, VentasModales, VentasPanelRoute, VentasCargaRoute, VentasLibroRoute, VentasCorrelRoute, VentasRg90Route } from './views/VentasRutas';

import {
  MeInfo,
  getAuthToken,
  setAuthToken,
  getMeApi,
} from './services/api';

export type Screen = 'inicio' | 'dashboard' | 'carga' | 'correl' | 'rg90' | 'libroCompleto' | 'compras' | 'locales' | 'usuarios' | 'roles';

// Tipado por Screen (no Record<string, ...>) a propósito: si se agrega una pantalla nueva y
// se olvida su entrada acá, TITLES[screen] da undefined y el destructuring de abajo revienta
// en runtime sin ningún error de compilación — ya pasó una vez con 'compras'. Con este tipo,
// TypeScript obliga a completar las 10 claves.
const TITLES: Record<Screen, [string, string]> = {
  inicio: ['Inicio', 'Elegí a dónde querés ir'],
  dashboard: ['Panel general', 'Estado de la conciliación del libro de ventas'],
  carga: ['Carga y libro de ventas', 'Reportes en bruto, conversión y libro unificado'],
  correl: ['Control de correlatividad', 'Saltos de numeración detectados por local'],
  rg90: ['Comparación contra RG90', 'Cruce del libro de ventas propio contra el organismo recaudador'],
  libroCompleto: ['Libro de ventas completo', 'Todos los comprobantes cargados, sin recortar por paginado'],
  compras: ['Libro de Compras', 'Carga, revisión y comparación del libro de compras contra la RG'],
  locales: ['Locales', 'Alta, edición y baja de locales — se usan para determinar el local de cada comprobante'],
  usuarios: ['Usuarios', 'Alta, edición y baja de usuarios del sistema'],
  roles: ['Roles y permisos', 'Qué pantallas y botones puede usar cada rol'],
};

// Mapa de URLs por pantalla (migración a React Router — antes `screen` era un string en
// memoria, sin URL propia, así que F5 siempre volvía a Inicio). 'rg90' apunta al paso 3
// (Adjuntar RG90) por default; el paso 4 (Resultado) tiene su propia URL — ver
// rg90PasoMostrado más abajo, derivado de location.pathname, no de este mapa.
const SCREEN_PATHS: Record<Screen, string> = {
  inicio: '/',
  dashboard: '/panel',
  carga: '/ventas/carga',
  correl: '/ventas/correlatividad',
  rg90: '/ventas/rg90/adjuntar',
  libroCompleto: '/ventas/libro-completo',
  compras: '/compras/carga',
  locales: '/locales',
  usuarios: '/usuarios',
  roles: '/roles',
};

function pathForScreen(s: Screen): string {
  return SCREEN_PATHS[s];
}

// Inversa de SCREEN_PATHS — de una URL cualquiera a la pantalla lógica que representa
// (para TITLES, el resaltado del Sidebar, y el efecto que carga roles/usuarios). Los
// prefijos alcanzan: cualquier sub-ruta de /ventas/rg90 (adjuntar o resultado) sigue
// siendo la pantalla 'rg90'; cualquier sub-ruta de /compras sigue siendo 'compras'.
function screenForPath(pathname: string): Screen {
  if (pathname.startsWith('/ventas/rg90')) return 'rg90';
  if (pathname.startsWith('/ventas/correlatividad')) return 'correl';
  if (pathname.startsWith('/ventas/libro-completo')) return 'libroCompleto';
  if (pathname.startsWith('/ventas/carga')) return 'carga';
  if (pathname.startsWith('/compras')) return 'compras';
  if (pathname.startsWith('/panel')) return 'dashboard';
  if (pathname.startsWith('/locales')) return 'locales';
  if (pathname.startsWith('/usuarios')) return 'usuarios';
  if (pathname.startsWith('/roles')) return 'roles';
  return 'inicio';
}

export function App() {
  const [authed, setAuthed] = useState<boolean>(!!getAuthToken());
  // El sidebar arranca cerrado siempre (login o recarga) — se abre a demanda con el botón
  // hamburguesa del Header; nunca se persiste el estado entre sesiones a propósito.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  // `screen` ya no es estado propio: se deriva de la URL real (React Router), así que un
  // F5 o un link directo aterrizan en la pantalla correcta en vez de siempre "Inicio" — ver
  // SCREEN_PATHS/screenForPath más arriba. goTo() navega a la URL de esa pantalla; el botón
  // "Volver" del Header usa el historial real del navegador (navigate(-1)) en vez de una
  // pila propia. No confundir con los botones "Volver" propios de cada wizard (ej. Paso 2 →
  // Paso 1 dentro de Carga/RG90/Compras) — esos ya existen y siguen su propia lógica de
  // pasos, sin tocar.
  const location = useLocation();
  const navigate = useNavigate();
  const screen = screenForPath(location.pathname);
  const goTo = (next: Screen) => navigate(pathForScreen(next));
  // Paso 3 (Adjuntar RG90) vs paso 4 (Resultado) de la pantalla 'rg90': antes vivía en un
  // useState propio (rg90PasoMostrado); ahora es la URL misma la que lo indica — cada paso
  // tiene su propia ruta (/ventas/rg90/adjuntar vs /ventas/rg90/resultado).
  const rg90PasoMostrado: 3 | 4 = location.pathname === '/ventas/rg90/resultado' ? 4 : 3;
  const [, setShowLockedModal] = useState<boolean>(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; onConfirm: () => void } | null>(null);

  // Permisos dinámicos: qué pantallas y botones puede usar el usuario logueado, según su
  // rol. Se cargan una vez autenticado (junto con locales/roles/usuarios, que alimentan
  // tanto las pantallas de administración como la resolución de "local" del Paso 2).
  const [meInfo, setMeInfo] = useState<MeInfo | null>(null);
  // Los guards de permiso por ruta (más abajo, en <Routes>) necesitan saber si YA se sabe
  // el permiso real o si todavía no llegó la respuesta de /api/auth/me — sin esto, la
  // primera renderización tras un F5/link directo (permisos todavía vacío, en lo que
  // getMeApi() resuelve) hacía que puede('pantalla:x') diera false para CUALQUIER pantalla
  // y el guard rebotara a Inicio antes de que hubiera chance real de saber el permiso —
  // justo el bug que rompía la retención de URL que se pidió arreglar.
  const [meInfoLoaded, setMeInfoLoaded] = useState(false);
  const permisos = new Set(meInfo?.permisos || []);
  const puede = (clave: string) => permisos.has(clave);

  const {
    locales, localesLoading, localesError, refetchLocales,
    rolesAdmin, permisosCatalogo, rolesLoading, rolesError, refetchRoles,
    usuariosAdmin, usuariosLoading, usuariosError, refetchUsuarios,
  } = useAdministracion(screen, puede);

  useEffect(() => {
    if (!authed) return;
    getMeApi().then(setMeInfo).catch(() => setMeInfo(null)).finally(() => setMeInfoLoaded(true));
    refetchLocales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);


  const [title, subtitle] = TITLES[screen];

  if (!authed) {
    // Sin navegación acá a propósito: la URL actual queda tal cual (ej. si el token
    // expiró mientras el usuario estaba en /ventas/rg90/resultado), así que al loguearse
    // de nuevo vuelve exactamente a donde estaba — la única vez que se fuerza el regreso a
    // Inicio es al cerrar sesión explícitamente (ver handleLogout), que es el caso real
    // donde importa no heredar la pantalla de un usuario anterior en la misma pestaña.
    return <LoginView onLoginSuccess={() => setAuthed(true)} />;
  }

  const handleLogout = () => {
    setAuthToken(null);
    setAuthed(false);
    // Si después entra otro usuario en la misma pestaña, que no herede la pantalla en la
    // que había quedado la sesión anterior.
    navigate('/', { replace: true });

    // Limpieza del libro persistido (ver src/utils/persistStore.ts): por pedido explícito,
    // el libro cargado sobrevive a un refresh/cuelgue pero SOLO se borra acá, al cerrar
    // sesión — nunca por otro motivo. Se borra la clave DE ESTE usuario específicamente (no
    // una clave global — ver el namespacing por meInfo.id en los efectos de arriba). El
    // estado de Ventas en memoria no hace falta resetearlo acá: al mostrarse el login, el
    // VentasProvider se desmonta y su estado se descarta, así que otro usuario que entre en
    // la misma pestaña no ve el libro anterior. Compras tampoco: ComprasView se desmonta al
    // salir de su pantalla.
    if (meInfo) {
      idbDelete(`${VENTAS_PERSIST_KEY}:${meInfo.id}`);
      idbDelete(`${COMPRAS_PERSIST_KEY}:${meInfo.id}`);
      // Clave chica y separada donde ComprasView guarda solo el paso actual (ver el porqué
      // en su propio comentario, en ComprasView.tsx) — hay que borrarla también, si no
      // quedaría huérfana con el id de este usuario en IndexedDB.
      idbDelete(`${COMPRAS_PERSIST_KEY}:${meInfo.id}:paso`);
    }
    // meInfoLoaded/meInfo vuelven a su estado inicial: si no se resetean, un login
    // inmediato del siguiente usuario en la misma pestaña no dispara de nuevo la
    // hidratación de Ventas (que depende de que meInfoLoaded pase de false a true).
    setMeInfo(null);
    setMeInfoLoaded(false);
  };


  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#faf9f5' }}>
      <Sidebar
        currentScreen={screen}
        onNavigate={(sc) => {
          goTo(sc);
          // Cerrar al navegar: en mobile evita que el menú tape la pantalla elegida; en
          // desktop es consistente que el mismo gesto (elegir una opción) siempre cierre.
          setSidebarOpen(false);
        }}
        permisos={permisos}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* El sidebar es siempre un overlay (position: fixed) — nunca reserva espacio propio
          con un margin fijo en <main>, así el contenido usa el 100% del ancho disponible
          tanto con el menú abierto como cerrado, en cualquier tamaño de pantalla. */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header
          title={title}
          subtitle={subtitle}
          onLogout={handleLogout}
          onToggleSidebar={() => setSidebarOpen(v => !v)}
          // Nunca en Inicio — es siempre la "raíz", no tiene desde dónde volver. El resto
          // usa el historial real del navegador (navigate(-1)) en vez de una pila propia.
          onGoBack={screen !== 'inicio' ? () => navigate(-1) : undefined}
          usuario={meInfo}
        />

        <div className="app-content-pad" style={{ flex: 1, minWidth: 0 }}>
        {/* La key es la SECCIÓN (primer segmento de la URL), no la ruta completa: con
            location.pathname cada cambio de paso dentro de Compras (/compras/carga →
            /compras/rg → /compras/resultado) remontaba toda la vista, que vuelve a leer el
            libro entero de IndexedDB (varios segundos) y restauraba el paso guardado, así que
            el click de "paso 2" rebotaba a "resultado". Cambiar de módulo sí reinicia el boundary. */}
        <ErrorBoundary key={location.pathname.split('/')[1] || 'inicio'}>
        <VentasProvider
          params={{ locales, location, meInfo, meInfoLoaded, navigate, rg90PasoMostrado, screen, setConfirmModal, setShowLockedModal }}
          puede={puede}
          goTo={goTo}
        >
        <Routes>
          <Route path="/" element={(
            <InicioView
              nombreUsuario={meInfo?.nombre}
              permisos={permisos}
              onNavigate={(sc) => goTo(sc)}
            />
          )} />

          <Route path="/panel" element={!meInfoLoaded ? null : puede('pantalla:dashboard') ? <VentasPanelRoute /> : <Navigate to="/" replace />} />

          <Route path="/ventas/carga" element={!meInfoLoaded ? null : puede('pantalla:carga') ? <VentasCargaRoute /> : <Navigate to="/" replace />} />

          <Route path="/ventas/libro-completo" element={!meInfoLoaded ? null : puede('pantalla:carga') ? <VentasLibroRoute /> : <Navigate to="/" replace />} />

          <Route path="/ventas/correlatividad" element={!meInfoLoaded ? null : puede('pantalla:carga') ? <VentasCorrelRoute /> : <Navigate to="/" replace />} />

          <Route path="/compras/:paso" element={!meInfoLoaded ? null : puede('pantalla:compras') ? (
            <ComprasView locales={locales} permisos={permisos} usuarioId={meInfo?.id} />
          ) : <Navigate to="/" replace />} />
          <Route path="/compras" element={<Navigate to="/compras/carga" replace />} />

          <Route path="/locales" element={!meInfoLoaded ? null : puede('pantalla:locales') ? (
            <LocalesView
              locales={locales}
              loading={localesLoading}
              error={localesError}
              refetch={refetchLocales}
              canCrear={puede('boton:locales.crear')}
              canEditar={puede('boton:locales.editar')}
              canEliminar={puede('boton:locales.eliminar')}
            />
          ) : <Navigate to="/" replace />} />

          <Route path="/usuarios" element={!meInfoLoaded ? null : puede('pantalla:usuarios') ? (
            <UsuariosView
              usuarios={usuariosAdmin}
              roles={rolesAdmin.length > 0 ? rolesAdmin : []}
              loading={usuariosLoading}
              error={usuariosError}
              refetch={refetchUsuarios}
              currentUserId={meInfo?.id ?? -1}
              canCrear={puede('boton:usuarios.crear')}
              canEditar={puede('boton:usuarios.editar')}
              canEliminar={puede('boton:usuarios.eliminar')}
            />
          ) : <Navigate to="/" replace />} />

          <Route path="/roles" element={!meInfoLoaded ? null : puede('pantalla:roles') ? (
            <RolesView
              roles={rolesAdmin}
              permisos={permisosCatalogo}
              loading={rolesLoading}
              error={rolesError}
              refetch={refetchRoles}
              canCrear={puede('boton:roles.crear')}
              canEditar={puede('boton:roles.editar')}
              canEliminar={puede('boton:roles.eliminar')}
            />
          ) : <Navigate to="/" replace />} />

          <Route path="/ventas/rg90" element={<Navigate to="/ventas/rg90/adjuntar" replace />} />
          <Route path="/ventas/rg90/:paso" element={!meInfoLoaded ? null : puede('pantalla:carga') ? <VentasRg90Route /> : <Navigate to="/" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <VentasModales />
        </VentasProvider>
        </ErrorBoundary>
        </div>
      </main>

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={() => {
            confirmModal.onConfirm();
            setConfirmModal(null);
          }}
          onClose={() => setConfirmModal(null)}
        />
      )}

    </div>
  );
}

export default App;
