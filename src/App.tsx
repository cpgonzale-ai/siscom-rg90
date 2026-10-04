import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ConfirmModal } from './components/ConfirmModal';
import { ProcessingModal } from './components/ProcessingModal';
import { ProgressModal } from './components/ProgressModal';
import { ComprobantesDuplicadosModal } from './components/ComprobantesDuplicadosModal';
import { cancelarOperacionEnCurso } from './utils/progreso';
import { ErrorBoundary } from './components/ErrorBoundary';

import { InicioView } from './views/InicioView';
import { DashboardView } from './views/DashboardView';
import { CargaView } from './views/CargaView';
import { CorrelatividadView } from './views/CorrelatividadView';
import { RG90View } from './views/RG90View';
import { LoginView } from './views/LoginView';
import { LibroCompletoView } from './views/LibroCompletoView';
import { ComprasView } from './views/ComprasView';
import { LocalesView } from './views/LocalesView';
import { UsuariosView } from './views/UsuariosView';
import { RolesView } from './views/RolesView';
import { idbDelete, VENTAS_PERSIST_KEY, COMPRAS_PERSIST_KEY } from './utils/persistStore';
import { useAdministracion } from './hooks/useAdministracion';
import { useVentas, SYSTEMS_META } from './hooks/useVentas';

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


  const {
    analyzeRg90, cargaUploaderOpen, convertError, converted, converting, correlFiltro, correlatividadRows,
    currentPage, dashboardSteps, deleteLibro, descargandoLimpio, diffAllValuesPorColumna, doConvert,
    downloadLimpio, filteredCorrel, filteredLibro, filteredRg90Diff, filteredRg90Rows, filtro, guidanceText,
    handleFileUpload, handleRg90FileUpload, hasAnyUpload, hayLibroColFiltrosActivos,
    hayRg90GridColFiltrosActivos, importStatusComputed, isFreshStart, libroColumnFilters,
    libroCompletoFiltrado, libroCompletoSearch, libroProgress, libroRows, libroTotales,
    limpiarLibroColFiltros, limpiarRg90GridColFiltros, nextCtaAction, nextCtaLabel, pageSize, pagedLibro,
    pagedRg90Rows, quitarRg90Archivo, removeAllFiles, resetRg90, rg90Attached, rg90CardsState,
    rg90CategoryFilter, rg90DuplicadosError, rg90Error, rg90Files, rg90GapsRows, rg90GridColumnFilters,
    rg90GridCurrentPage, rg90GridSearch, rg90GridTotalPages, rg90GridTotales, rg90Loaded, rg90Progress,
    rg90Rows, rg90Search, rg90Summary, searchGeneral, selectedSystemKey, setCargaUploaderOpen,
    setConvertError, setConverted, setCorrelFiltro, setCorrelatividadRows, setCortesRows, setFiltro,
    setLibroCompletoSearch, setLibroRows, setLoteId, setPage, setRg90CategoryFilter, setRg90DiffRows,
    setRg90DuplicadosError, setRg90Error, setRg90Files, setRg90GapsRows, setRg90GridPage, setRg90GridSearch,
    setRg90Loaded, setRg90Rows, setRg90Search, setRg90Summary, setSearchGeneral, setSelectedSystemKey,
    setUploadedFiles, simulateRg90Upload, simulateUpload, totalPages, uploadedFiles, ventasHydratedRef,
    wizardSteps,
  } = useVentas({ locales, location, meInfo, meInfoLoaded, navigate, rg90PasoMostrado, screen, setConfirmModal, setShowLockedModal });
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
    // una clave global — ver el namespacing por meInfo.id en los efectos de arriba), y se
    // resetea también el estado de Ventas en memoria (Compras no hace falta: ComprasView se
    // desmonta solo al salir de screen==='compras', ver App.tsx más abajo, así que ya
    // arranca vacío la próxima vez) para que si otro usuario entra después en la misma
    // pestaña no vea ni por un instante el libro del usuario anterior antes de que la
    // próxima carga lo pise.
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
    // hidratación de arriba (que depende de que meInfoLoaded pase de false a true), y
    // ventasHydratedRef en false evita que el efecto de guardado escriba con el estado
    // vacío de abajo ANTES de que la hidratación del próximo usuario tenga chance de correr.
    setMeInfo(null);
    setMeInfoLoaded(false);
    ventasHydratedRef.current = false;
    setConverted(false);
    setRg90Loaded(false);
    setLibroRows([]);
    setCorrelatividadRows([]);
    setCortesRows([]);
    setRg90Rows([]);
    setRg90GapsRows([]);
    setRg90DiffRows([]);
    setRg90Summary(null);
    setLoteId(undefined);
    setCargaUploaderOpen(true);
    setUploadedFiles([]);
    setRg90Files([]);
  };

  // Único indicador de "la RG90 está siendo analizada" (adjuntar o comparar, ver
  // rg90Progress) -- reemplaza al viejo estado rg90Analyzing para que sea imposible tener
  // dos indicadores de progreso de RG90 activos a la vez.
  const rg90Busy = rg90Progress !== null;

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
        <Routes>
          <Route path="/" element={(
            <InicioView
              nombreUsuario={meInfo?.nombre}
              permisos={permisos}
              onNavigate={(sc) => goTo(sc)}
            />
          )} />

          <Route path="/panel" element={!meInfoLoaded ? null : puede('pantalla:dashboard') ? (
            <DashboardView
              steps={dashboardSteps}
              isFreshStart={isFreshStart}
              converted={converted}
              rg90Loaded={rg90Loaded}
              hasAnyUpload={hasAnyUpload}
              guidanceText={guidanceText}
              nextCtaLabel={nextCtaLabel}
              nextCtaAction={nextCtaAction}
              importStatus={importStatusComputed}
              kpiLocales={converted ? `${new Set(libroRows.map(r => r.local)).size}` : '0'}
              kpiComprobantes={converted ? `${libroRows.length}` : '0'}
              kpiSaltos={converted ? `${correlatividadRows.length}` : '—'}
              onGoCargaVentas={() => goTo('carga')}
              onGoCargaCompras={() => goTo('compras')}
              canCargaVentas={puede('pantalla:carga')}
              canCargaCompras={puede('pantalla:compras')}
            />
          ) : <Navigate to="/" replace />} />

          <Route path="/ventas/carga" element={!meInfoLoaded ? null : puede('pantalla:carga') ? (
            <CargaView
              wizardSteps={wizardSteps}
              systemOptions={SYSTEMS_META}
              selectedSystemKey={selectedSystemKey}
              onSelectSystem={(e) => setSelectedSystemKey(e.target.value)}
              simulateUpload={simulateUpload}
              onFileUpload={handleFileUpload}
              uploadedFilesList={uploadedFiles.map(f => ({
                ...f,
                sistemaLabel: f.sistemaLabel || 'Detectando…',
                removeFile: () => setUploadedFiles(prev => prev.filter(x => x.id !== f.id)),
              }))}
              removeAllFiles={removeAllFiles}
              canEliminarTodos={puede('boton:carga.eliminar_todos')}
              canConvertir={puede('boton:carga.convertir')}
              canBorrarLibro={puede('boton:carga.borrar_libro')}
              canDescargarCsv={puede('boton:carga.descargar_csv')}
              canConvert={hasAnyUpload}
              convertHelpText={
                converted
                  ? 'Ya existe un análisis generado para estos reportes.'
                  : hasAnyUpload
                  ? 'Se detecta automáticamente el sistema de cada reporte adjuntado (Aloha, Hiopos o Universal) para armar el libro de ventas unificado.'
                  : 'Adjuntá un reporte de Aloha, Hiopos o del Formato Universal para habilitar el análisis.'
              }
              convertBtnStyle={
                hasAnyUpload || converted
                  ? 'background:#f0a63d;color:#1a1a1a;border:none;border-radius:7px;padding:12px 20px;font-size:13px;font-weight:700;cursor:pointer'
                  : 'background:#e5e2da;color:#9aa1ab;border:none;border-radius:7px;padding:12px 20px;font-size:13px;font-weight:700;cursor:not-allowed'
              }
              doConvert={doConvert}
              converting={converting}
              convertError={convertError}
              converted={converted}
              showCargaCard={!converted || cargaUploaderOpen}
              showStep2Content={converted && !cargaUploaderOpen}
              openCargaUploader={() => setCargaUploaderOpen(true)}
              closeCargaUploader={() => setCargaUploaderOpen(false)}
              goToRg90={() => navigate('/ventas/rg90/adjuntar')}
              saltosRows={correlatividadRows}
              deleteLibro={deleteLibro}
              downloadLimpio={() => downloadLimpio(filteredLibro)}
              descargandoLimpio={descargandoLimpio}
              pagedLibro={pagedLibro}
              libroColumnFilters={libroColumnFilters}
              hayLibroColFiltrosActivos={hayLibroColFiltrosActivos}
              limpiarLibroColFiltros={limpiarLibroColFiltros}
              libroTotales={libroTotales}
              filterStyleTodos={filtro === 'Todos' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
              filterStyleAloha={filtro === 'Aloha' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
              filterStyleHiopos={filtro === 'Hiopos' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
              filterStyleUniversal={filtro === 'Universal' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
              setFilterTodos={() => { setFiltro('Todos'); setPage(1); }}
              setFilterAloha={() => { setFiltro('Aloha'); setPage(1); }}
              setFilterHiopos={() => { setFiltro('Hiopos'); setPage(1); }}
              setFilterUniversal={() => { setFiltro('Universal'); setPage(1); }}
              searchGeneral={searchGeneral}
              onSearchGeneral={(e) => { setSearchGeneral(e.target.value); setPage(1); }}
              clearSearch={() => { setSearchGeneral(''); setPage(1); }}
              filteredCount={filteredLibro.length}
              currentPage={currentPage}
              totalPages={totalPages}
              prevPage={() => setPage(p => Math.max(1, p - 1))}
              nextPage={() => setPage(p => Math.min(totalPages, p + 1))}
              pageRangeLabel={
                filteredLibro.length === 0
                  ? '0'
                  : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredLibro.length)}`
              }
              prevBtnStyle={`background:#fff;border:1px solid #e2e0da;color:${currentPage <= 1 ? '#c7c3ba' : '#128752'};border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:${currentPage <= 1 ? 'default' : 'pointer'}`}
              nextBtnStyle={`background:#fff;border:1px solid #e2e0da;color:${currentPage >= totalPages ? '#c7c3ba' : '#128752'};border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:${currentPage >= totalPages ? 'default' : 'pointer'}`}
              onVerTodos={() => navigate('/ventas/libro-completo')}
              step2Cards={[
                { label: 'Locales', value: `${new Set(libroRows.map(r => r.local)).size}` },
                { label: 'Comprobantes', value: `${libroRows.length}` },
                { label: 'Saltos', value: `${correlatividadRows.length}` },
              ]}
            />
          ) : <Navigate to="/" replace />} />

          <Route path="/ventas/libro-completo" element={!meInfoLoaded ? null : puede('pantalla:carga') ? (
            <LibroCompletoView
              rows={libroCompletoFiltrado}
              totalSinFiltrar={libroRows.length}
              search={libroCompletoSearch}
              onSearch={(e) => setLibroCompletoSearch(e.target.value)}
              onVolver={() => { setLibroCompletoSearch(''); navigate('/ventas/carga'); }}
              onDownload={() => downloadLimpio(libroCompletoFiltrado)}
              descargando={descargandoLimpio}
            />
          ) : <Navigate to="/" replace />} />

          <Route path="/ventas/correlatividad" element={!meInfoLoaded ? null : puede('pantalla:carga') ? (
            <CorrelatividadView
              correlatividad={filteredCorrel}
              correlFiltro={correlFiltro}
              correlFilterStyleTodos={correlFiltro === 'Todos' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
              correlFilterStyleAloha={correlFiltro === 'Aloha' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
              correlFilterStyleHiopos={correlFiltro === 'Hiopos' ? 'background:#128752;border:1px solid #128752;color:#fff;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer' : 'background:#fff;border:1px solid #e2e0da;color:#5c6470;border-radius:7px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer'}
              setCorrelTodos={() => setCorrelFiltro('Todos')}
              setCorrelAloha={() => setCorrelFiltro('Aloha')}
              setCorrelHiopos={() => setCorrelFiltro('Hiopos')}
            />
          ) : <Navigate to="/" replace />} />

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
          <Route path="/ventas/rg90/:paso" element={!meInfoLoaded ? null : puede('pantalla:carga') ? (
            <RG90View
              wizardSteps={wizardSteps}
              pasoMostrado={rg90PasoMostrado}
              onVolverCarga={() => navigate('/ventas/carga')}
              onSiguienteResultado={() => rg90Loaded && navigate('/ventas/rg90/resultado')}
              onVolverPaso3={() => navigate('/ventas/rg90/adjuntar')}
              saltosLibroRows={correlatividadRows}
              saltosRgRows={rg90GapsRows}
              rg90Loaded={rg90Loaded}
              rg90Attached={rg90Attached}
              rg90StatusText={
                rg90Busy
                  ? 'Analizando y comparando contra la RG90 en el servidor…'
                  : rg90Loaded
                  ? `Archivo cargado y comparado — ${rg90Files.map(f => f.name).join(', ')}`
                  : rg90Attached
                  ? `Archivo adjuntado — ${rg90Files.map(f => f.name).join(', ')}. Presioná "Analizar y comparar" para generar el resultado.`
                  : ''
              }
              rg90FileLabel={rg90Attached ? `${rg90Files.length} archivo(s) adjuntado(s) — click para agregar más` : 'Adjuntar archivo(s) RG90 (.xls / .xlsx)'}
              rg90FileNames={rg90Files.map(f => f.name)}
              rg90DropzoneStyle={
                (rg90Attached ? 'background:#f4f2ed;color:#22262b;font-weight:600' : 'background:#fafbfa;color:#5c6470;border:1px dashed #cfd6d0') +
                ';flex:1;min-width:220px;border-radius:7px;padding:9px 14px;font-size:12.5px;cursor:pointer'
              }
              rg90AnalyzeBtnStyle={
                rg90Attached && !rg90Busy
                  ? 'background:#f0a63d;color:#1a1a1a;border:none;border-radius:7px;padding:10px 16px;font-size:12.5px;font-weight:700;cursor:pointer'
                  : 'background:#e5e2da;color:#9aa1ab;border:none;border-radius:7px;padding:10px 16px;font-size:12.5px;font-weight:700;cursor:not-allowed'
              }
              rg90Analyzing={rg90Busy}
              rg90Error={rg90Error}
              canComparar={puede('boton:rg90.comparar')}
              canQuitarArchivo={puede('boton:rg90.quitar_archivo')}
              simulateRg90={simulateRg90Upload}
              onRg90FileUpload={handleRg90FileUpload}
              onQuitarRg90Archivo={quitarRg90Archivo}
              analyzeRg90={analyzeRg90}
              resetRg90={resetRg90}
              rg90Cards={rg90CardsState.map(c => ({
                ...c,
                isActive: rg90CategoryFilter === c.key,
                onClick: () => setRg90CategoryFilter(prev => (prev === c.key ? '' : c.key)),
              }))}
              anuladasCount={rg90Summary?.anuladas ?? 0}
              totalLibroCount={libroRows.length}
              rg90Diff={filteredRg90Diff}
              diffAllValuesPorColumna={diffAllValuesPorColumna}
              rg90Search={rg90Search}
              onRg90Search={(e) => setRg90Search(e.target.value)}
              clearRg90Search={() => setRg90Search('')}
              rg90CategoryFilter={rg90CategoryFilter}
              clearRg90Category={() => setRg90CategoryFilter('')}
              rg90GridRows={pagedRg90Rows}
              rg90GridExportRows={filteredRg90Rows}
              rg90GridTotalCount={rg90Rows.length}
              rg90GridFilteredCount={filteredRg90Rows.length}
              rg90GridColumnFilters={rg90GridColumnFilters}
              hayRg90GridColFiltrosActivos={hayRg90GridColFiltrosActivos}
              limpiarRg90GridColFiltros={limpiarRg90GridColFiltros}
              rg90GridTotales={rg90GridTotales}
              rg90GridSearch={rg90GridSearch}
              onRg90GridSearch={(e) => { setRg90GridSearch(e.target.value); setRg90GridPage(1); }}
              rg90GridCurrentPage={rg90GridCurrentPage}
              rg90GridTotalPages={rg90GridTotalPages}
              rg90GridPrevPage={() => setRg90GridPage(p => Math.max(1, p - 1))}
              rg90GridNextPage={() => setRg90GridPage(p => Math.min(rg90GridTotalPages, p + 1))}
            />
          ) : <Navigate to="/" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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

      {/* Overlay bloqueante con barra de progreso mientras se lee/analiza el Excel del
          Libro (Paso 1→2, ver doConvert) -- nada de la pantalla siguiente queda visible
          detrás hasta que termina. Si converting sigue en pie pero libroProgress ya se
          limpió (no debería pasar, pero por las dudas) no se muestra nada roto: ambos
          se limpian juntos en el finally de doConvert. */}
      {converting && libroProgress && (
        <ProgressModal
          message="Analizando archivo del Libro…"
          percent={libroProgress.percent}
          total={libroProgress.total}
          onCancel={cancelarOperacionEnCurso}
        />
      )}
      {/* Si termina en error (ej. archivo con formato incorrecto), se muestra con el modal
          genérico de siempre (sin barra, ya no hay ningún avance que mostrar) -- convertError
          ya viene limpio a null apenas arranca un intento nuevo (ver doConvert), así que solo
          queda en pie acá cuando la conversión ya terminó y falló. */}
      {!converting && convertError && (
        <ProcessingModal error={convertError} onClose={() => setConvertError(null)} />
      )}

      {/* Única pantalla de progreso para "Analizar y comparar" (ver analyzeRg90) -- leer/
          analizar la RG90 y compararla contra el libro corren como un solo proceso, con un
          solo mensaje y un solo porcentaje (ver el comentario en la declaración del estado
          más arriba). Adjuntar el archivo no toca este estado. */}
      {rg90Progress && (
        <ProgressModal
          message={rg90Progress.message}
          percent={rg90Progress.percent}
          total={rg90Progress.total}
          onCancel={cancelarOperacionEnCurso}
        />
      )}
      {/* Mismo criterio que con el Libro: sin barra, ya no hay ningún avance que mostrar --
          rg90Error ya viene limpio a null apenas arranca un intento nuevo. */}
      {!rg90Progress && rg90Error && (
        <ProcessingModal error={rg90Error} onClose={() => setRg90Error(null)} />
      )}

      {/* Comprobantes duplicados detectados al adjuntar el Libro o la RG90 -- mismo error
          de siempre (ver ReconcileDuplicadosError), mostrado en su propia grilla en vez del
          cartel de una línea de ProcessingModal (ver el porqué en rg90DuplicadosError). */}
      {rg90DuplicadosError && (
        <ComprobantesDuplicadosModal error={rg90DuplicadosError} onClose={() => setRg90DuplicadosError(null)} />
      )}
    </div>
  );
}

export default App;
