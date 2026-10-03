import { useEffect, useState, useMemo, useDeferredValue, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ConfirmModal } from './components/ConfirmModal';
import { ProcessingModal } from './components/ProcessingModal';
import { ProgressModal } from './components/ProgressModal';
import { ComprobantesDuplicadosModal } from './components/ComprobantesDuplicadosModal';
import { cancelarOperacionEnCurso, contarFilasAproximado, ejecutarConAvance, esCancelacion } from './utils/progreso';
import { CATEGORIA, COLOR_CATEGORIA } from './utils/categoriasDiferencia';

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
import { formatGs } from './utils/format';
import { idbGet, idbSet, idbDelete, VENTAS_PERSIST_KEY, COMPRAS_PERSIST_KEY } from './utils/persistStore';
import { RG90_DIFF_COLUMNAS } from './utils/diffVentasColumns';

import {
  LibroRow,
  CorrelatividadRow,
  RG90DiffRow,
  ComprobantesDuplicadosError,
  ReconcileDuplicadosError,
  CorteRow,
  UploadedFileMeta,
  Local,
  Rol,
  Permiso,
  Usuario,
  MeInfo,
  ingestFilesApi,
  reconcileApi,
  validarDuplicadosLibroApi,
  getAuthToken,
  setAuthToken,
  getMeApi,
  listLocalesApi,
  listRolesApi,
  listPermisosApi,
  listUsuariosApi,
  exportarTablaExcelApi,
} from './services/api';

// Un local/sistema "matchea" un filtro por inclusión, no por igualdad: el backend
// devuelve el nombre completo del perfil (ej. "Aloha POS — Juan Valdez"), no la
// etiqueta corta ("Aloha") que usan los botones de filtro de la UI.
const matchesSistema = (valor: string, filtro: string) =>
  filtro === 'Todos' || (valor || '').toLowerCase().includes(filtro.toLowerCase());

type Screen = 'inicio' | 'dashboard' | 'carga' | 'correl' | 'rg90' | 'libroCompleto' | 'compras' | 'locales' | 'usuarios' | 'roles';

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

const SYSTEMS_META = [
  { key: 'aloha', label: 'Aloha', desc: 'Sistema de punto de venta · Juan Valdez' },
  { key: 'hiopos', label: 'Hiopos', desc: 'Sistema de punto de venta · La Cabrera, 100 M y otros' },
  { key: 'universal', label: 'Universal', desc: 'Planilla estándar para locales sin export de Aloha/Hiopos' },
];

// Columnas con filtro tipo Excel en la grilla del libro de ventas unificado (paso 2 de
// Carga). Se dejan afuera los importes (Gravadas/IVA/Exentas/Total): valores casi todos
// distintos entre sí, ahí ya está el buscador general — un listado de checkboxes no ayuda.
// Los importes usan el mismo texto ya formateado por el backend (r.gravadas, no
// r.gravadas_num) — el filtro tiene que ofrecer/comparar exactamente lo que se ve en la
// grilla, sin reformatear ("18.891.429,00" tal cual, nunca invertir coma y punto).
const LIBRO_COLUMNAS: { key: string; label: string; getValue: (r: LibroRow) => string }[] = [
  { key: 'doc', label: 'Documento', getValue: r => r.doc },
  { key: 'tipo_doc', label: 'Tipo', getValue: r => r.tipo_doc || 'Factura' },
  { key: 'sistema', label: 'Sistema', getValue: r => r.sistema },
  { key: 'local', label: 'Local', getValue: r => r.local },
  { key: 'fecha', label: 'Fecha', getValue: r => r.fecha },
  { key: 'ruc', label: 'RUC', getValue: r => r.ruc },
  { key: 'nombre', label: 'Nombre', getValue: r => r.nombre },
  { key: 'gravadas', label: 'Gravadas 10%', getValue: r => r.gravadas },
  { key: 'iva', label: 'IVA 10%', getValue: r => r.iva },
  { key: 'gravadas_5', label: 'Gravadas 5%', getValue: r => r.gravadas_5 ?? '0,00' },
  { key: 'iva_5', label: 'IVA 5%', getValue: r => r.iva_5 ?? '0,00' },
  { key: 'exentas', label: 'Exentas', getValue: r => r.exentas },
  { key: 'total', label: 'Total', getValue: r => r.total },
  { key: 'estado', label: 'Estado', getValue: r => r.estado },
];

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
  const [selectedSystemKey, setSelectedSystemKey] = useState<string>('aloha');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileMeta[]>([]);
  const [converted, setConverted] = useState<boolean>(false);
  const [rg90Loaded, setRg90Loaded] = useState<boolean>(false);
  const [rg90Attached, setRg90Attached] = useState<boolean>(false);
  const [cargaUploaderOpen, setCargaUploaderOpen] = useState<boolean>(true);
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

  const [locales, setLocales] = useState<Local[]>([]);
  const [localesLoading, setLocalesLoading] = useState(false);
  const [localesError, setLocalesError] = useState<string | null>(null);
  const refetchLocales = () => {
    setLocalesLoading(true);
    listLocalesApi().then(setLocales).catch(e => setLocalesError(e instanceof Error ? e.message : 'Error al cargar locales')).finally(() => setLocalesLoading(false));
  };

  const [rolesAdmin, setRolesAdmin] = useState<Rol[]>([]);
  const [permisosCatalogo, setPermisosCatalogo] = useState<Permiso[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const refetchRoles = () => {
    setRolesLoading(true);
    Promise.all([listRolesApi(), listPermisosApi()])
      .then(([r, p]) => { setRolesAdmin(r); setPermisosCatalogo(p); })
      .catch(e => setRolesError(e instanceof Error ? e.message : 'Error al cargar roles'))
      .finally(() => setRolesLoading(false));
  };

  const [usuariosAdmin, setUsuariosAdmin] = useState<Usuario[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);
  const refetchUsuarios = () => {
    setUsuariosLoading(true);
    listUsuariosApi().then(setUsuariosAdmin).catch(e => setUsuariosError(e instanceof Error ? e.message : 'Error al cargar usuarios')).finally(() => setUsuariosLoading(false));
  };

  useEffect(() => {
    if (!authed) return;
    getMeApi().then(setMeInfo).catch(() => setMeInfo(null)).finally(() => setMeInfoLoaded(true));
    refetchLocales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Roles y usuarios son admin-only y más pesados (traen el catálogo completo de
  // permisos) — se cargan recién al entrar a esas pantallas, no en cada login. La
  // pantalla de Usuarios también necesita la lista de roles para el selector del form.
  useEffect(() => {
    if (screen === 'roles' && puede('pantalla:roles')) refetchRoles();
    if (screen === 'usuarios' && puede('pantalla:usuarios')) {
      refetchUsuarios();
      if (rolesAdmin.length === 0) refetchRoles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const [filtro, setFiltro] = useState<string>('Todos');
  const [estadoFilter] = useState<string>('');
  const [correlFiltro, setCorrelFiltro] = useState<string>('Todos');
  const [searchGeneral, setSearchGeneral] = useState<string>('');
  const [libroColFiltros, setLibroColFiltros] = useState<Record<string, Set<string> | null>>({});
  const [page, setPage] = useState<number>(1);
  const [libroCompletoSearch, setLibroCompletoSearch] = useState<string>('');
  const pageSize = 20;

  const [rg90Search, setRg90Search] = useState<string>('');
  const [rg90CategoryFilter, setRg90CategoryFilter] = useState<string>('');

  // Paso 3 (Adjuntar RG90 y listar) vs Paso 4 (Resultado) — mismo criterio que el
  // pasoMostrado de ComprasView: se muestra un paso a la vez, no se acumula todo abajo.
  // (rg90PasoMostrado en sí ya se calculó más arriba, derivado de la URL — ver ahí.)
  const [rg90Rows, setRg90Rows] = useState<LibroRow[]>([]);
  const [rg90GridSearch, setRg90GridSearch] = useState<string>('');
  const [rg90GridPage, setRg90GridPage] = useState<number>(1);
  const [rg90GridColFiltros, setRg90GridColFiltros] = useState<Record<string, Set<string> | null>>({});
  // Saltos de numeración detectados DENTRO de la RG90 (no contra el libro propio) — mismo
  // detector que ya corre sobre el libro propio en /api/ingest, ahora también sobre
  // rg90_rows en /api/reconcile (ver Paso 3).
  const [rg90GapsRows, setRg90GapsRows] = useState<CorrelatividadRow[]>([]);

  const [libroRows, setLibroRows] = useState<LibroRow[]>([]);
  const [correlatividadRows, setCorrelatividadRows] = useState<CorrelatividadRow[]>([]);
  const [cortesRows, setCortesRows] = useState<CorteRow[]>([]);
  const [rg90DiffRows, setRg90DiffRows] = useState<RG90DiffRow[]>([]);
  const [rg90Files, setRg90Files] = useState<File[]>([]);
  const [rg90Error, setRg90Error] = useState<string | null>(null);
  // Caso especial de rg90Error: comprobantes duplicados detectados al adjuntar el Libro o
  // la RG90 (misma validación de siempre, ver ReconcileDuplicadosError en services/api.ts)
  // — se muestra en su propio modal con grilla en vez del cartel de una sola línea de
  // ProcessingModal, por eso vive en un estado aparte.
  const [rg90DuplicadosError, setRg90DuplicadosError] = useState<ComprobantesDuplicadosError | null>(null);
  const [rg90Summary, setRg90Summary] = useState<{ coinciden: number; no_en_rg90: number; no_en_libro: number; saltos: number; diferencia_importe: number; diferencias_tasas: number; anuladas: number } | null>(null);
  const [loteId, setLoteId] = useState<number | undefined>(undefined);
  const [converting, setConverting] = useState<boolean>(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  // Indicador de avance mientras se analiza el Excel del Libro (doConvert) -- ver
  // ProgressModal/utils/progreso.ts. null = no hay ningún análisis de archivo en curso
  // ahora mismo (se usa también como condición de render).
  const [libroProgress, setLibroProgress] = useState<{ percent: number; total: number } | null>(null);
  // Progreso de "Analizar y comparar" (ver analyzeRg90) -- a propósito, adjuntar el archivo
  // (handleRg90FileUpload) NO toca este estado ni dispara ningún análisis: leer/analizar la
  // RG90 (duplicados incluidos) y compararla contra el libro son, de cara al usuario, un
  // solo paso con una sola pantalla de progreso, que arranca recién con el click en
  // "Analizar y comparar" -- nunca antes, y nunca dos pantallas para esto.
  const [rg90Progress, setRg90Progress] = useState<{ percent: number; total: number; message: string } | null>(null);

  // Persistencia del libro de Ventas (ver src/utils/persistStore.ts): si la página se
  // recarga por accidente, el navegador se cuelga o se cierra, el usuario no pierde el
  // libro ya cargado ni el resultado de la comparación contra la RG90 al volver a entrar.
  // No se persiste uploadedFiles/rg90Files (son objetos File del navegador — no se pueden
  // serializar, y de todos modos lo que importa recuperar es el libro YA procesado, no el
  // archivo crudo). ventasHydratedRef evita que el efecto de guardado de abajo pise el
  // dato guardado con el estado vacío inicial antes de que termine de cargar el propio.
  const ventasHydratedRef = useRef(false);
  // Mismo momento que ventasHydratedRef, pero como estado (no ref) para que el efecto de
  // más abajo (el que redirige si la URL pide un paso que todavía no es alcanzable) se
  // vuelva a evaluar justo cuando la hidratación termina — un ref no dispara un re-render,
  // así que ese efecto nunca se habría vuelto a correr con los datos ya restaurados.
  const [ventasHydrated, setVentasHydrated] = useState(false);

  useEffect(() => {
    // Espera a que se sepa QUIÉN está logueado antes de tocar IndexedDB: sin esto, esta
    // hidratación corría una sola vez al montar App (con el mount-once de []), sin importar
    // si ya había una sesión activa o no en ese instante. En una PC compartida, si el
    // Usuario A cierra el navegador (o se cuelga) sin apretar "Cerrar sesión", su libro
    // quedaba en IndexedDB; cuando el Usuario B abría la app y se logueaba, esta
    // hidratación ya se había disparado ANTES de que B iniciara sesión y podía llegar a
    // mostrarle el libro de A. Al esperar meInfoLoaded y usar la clave por usuario de abajo
    // (ver claveVentas), cada usuario solo puede leer su propia clave en IndexedDB.
    if (!meInfoLoaded || !meInfo) return;
    const claveVentas = `${VENTAS_PERSIST_KEY}:${meInfo.id}`;
    (async () => {
      try {
        const saved = await idbGet<{
          converted: boolean;
          rg90Loaded: boolean;
          libroRows: LibroRow[];
          correlatividadRows: CorrelatividadRow[];
          cortesRows: CorteRow[];
          rg90Rows: LibroRow[];
          rg90GapsRows: CorrelatividadRow[];
          rg90DiffRows: RG90DiffRow[];
          rg90Summary: typeof rg90Summary;
          loteId?: number;
          rg90PasoMostrado: 3 | 4;
        }>(claveVentas);
        if (saved) {
          setConverted(saved.converted);
          setRg90Loaded(saved.rg90Loaded);
          setLibroRows(saved.libroRows ?? []);
          setCorrelatividadRows(saved.correlatividadRows ?? []);
          setCortesRows(saved.cortesRows ?? []);
          setRg90Rows(saved.rg90Rows ?? []);
          setRg90GapsRows(saved.rg90GapsRows ?? []);
          setRg90DiffRows(saved.rg90DiffRows ?? []);
          setRg90Summary(saved.rg90Summary ?? null);
          setLoteId(saved.loteId);
          // rg90PasoMostrado ya no es estado propio (se lee de la URL, ver arriba) — no
          // hay nada que restaurar acá; si el paso guardado ya no es alcanzable con estos
          // datos, el efecto de más abajo (el guard de reachability) se encarga de
          // redirigir. A propósito NO se navega automáticamente hacia adelante al paso
          // guardado como antes: esta hidratación corre en App, que está montado siempre
          // sin importar en qué pantalla esté el usuario — navegar acá lo sacaría de
          // cualquier pantalla en la que estuviera (ej. Inicio) para meterlo de golpe en
          // el resultado de Ventas, que es justo el comportamiento que NO se quiere.
          //
          // Mismo criterio que doConvert al terminar bien: si ya había un libro
          // convertido guardado, mostrar directo el Paso 2 en vez del uploader vacío.
          if (saved.converted) setCargaUploaderOpen(false);
        }
      } catch {
        // idbGet ya atrapa sus propios errores internamente (ver persistStore.ts) y nunca
        // debería rechazar — este catch es solo una red de seguridad si ese contrato
        // cambia. No hay nada que mostrarle al usuario: simplemente arranca sin datos
        // restaurados en vez de dejar una rejection sin manejar en el arranque de la app.
      } finally {
        ventasHydratedRef.current = true;
        setVentasHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meInfoLoaded, meInfo?.id]);

  // Guard de navegación (reemplaza a screenHistory/goBack manual): si la URL actual pide
  // un paso de Ventas que todavía no es alcanzable con los datos reales (ej. entrar por
  // link directo a /ventas/rg90/resultado sin haber comparado nunca, o a cualquier
  // /ventas/rg90/* sin tener siquiera un libro convertido), se redirige al paso correcto
  // — MISMA regla de "reachable" que ya usa la barra de pasos (wizardSteps, más abajo), no
  // una nueva. Espera a que termine la hidratación (ventasHydrated) para no redirigir con
  // el estado vacío inicial, antes de que la persistencia tuviera chance de restaurar el
  // libro real.
  useEffect(() => {
    if (!ventasHydrated) return;
    if (location.pathname === '/ventas/rg90/resultado' && !rg90Loaded) {
      navigate('/ventas/rg90/adjuntar', { replace: true });
    } else if (location.pathname.startsWith('/ventas/rg90') && !converted) {
      navigate('/ventas/carga', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventasHydrated, location.pathname, converted, rg90Loaded]);

  // rg90PasoMostrado SE SACÓ de este guardado (payload y dependencias): ya no es estado
  // propio, se lee de la URL (ver arriba), y la hidratación de arriba a propósito NO lo
  // restaura ("no hay nada que restaurar acá" en su comentario) — quedó guardándose sin
  // que nadie lo leyera nunca. Medido con un archivo de 100.000 filas: al estar en las
  // dependencias, cada click entre Paso 3 y Paso 4 (rg90PasoMostrado cambia con la URL)
  // volvía a serializar y escribir TODO el libro en IndexedDB (libroRows, rg90DiffRows,
  // etc.), 1-3 segundos de bloqueo real por click, solo por un dato que nunca se usaba de
  // vuelta.
  useEffect(() => {
    // Misma clave por usuario que la hidratación de arriba — así lo que guarda el Usuario A
    // nunca puede terminar leyéndolo el Usuario B, aunque compartan la misma PC/navegador.
    if (!ventasHydratedRef.current || !meInfo) return;
    const claveVentas = `${VENTAS_PERSIST_KEY}:${meInfo.id}`;
    const t = setTimeout(() => {
      idbSet(claveVentas, {
        converted, rg90Loaded, libroRows, correlatividadRows, cortesRows,
        rg90Rows, rg90GapsRows, rg90DiffRows, rg90Summary, loteId,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [meInfo, converted, rg90Loaded, libroRows, correlatividadRows, cortesRows, rg90Rows, rg90GapsRows, rg90DiffRows, rg90Summary, loteId]);

  // Se saca la 4ª card "Saltos" que había acá: contaba diffs con diferencia ===
  // "Salto de numeración", un valor que reconcile_with_rg90() nunca asigna (siempre daba
  // 0) — quedaba confundible con el botón "Saltos" nuevo (total real de huecos de
  // numeración, libro + RG90), que si tiene datos. Ver rg90Summary.saltos en api.ts/main.py
  // si en algún momento se retoma esa categoría de diff.
  // Mismo patrón de redacción que RESUMEN_CATEGORIAS en ComprasView.tsx (antes estas
  // decían "Coinciden" / "No en RG90" / "No en libro venta" — mucho más cortas y crípticas
  // que las de Compras, pese a ser la misma idea) — alineadas acá para que ambas pantallas
  // usen el mismo criterio de claridad.
  // value queda como el número CRUDO en string (sin puntos de miles): RG90View vuelve a
  // convertirlo con Number(c.value) (ver porClave, en el Panel de Desglose Matemático) para
  // sumarlo -- si acá ya viniera formateado ("12.453"), Number("12.453") lo leería mal (como
  // 12,453 decimal, no doce mil). El punto de miles se agrega solo al MOSTRARLO, en
  // RG90View.tsx.
  const rg90CardsState = [
    { key: CATEGORIA.COINCIDE, label: 'Registros que coinciden', value: `${rg90Summary?.coinciden ?? 0}`, color: COLOR_CATEGORIA[CATEGORIA.COINCIDE] },
    { key: CATEGORIA.NO_LLEGO, label: 'Registros que no se encuentran en la RG90', value: `${rg90Summary?.no_en_rg90 ?? 0}`, color: COLOR_CATEGORIA[CATEGORIA.NO_LLEGO] },
    { key: CATEGORIA.NO_EXISTE_EN_LIBRO, label: 'Registros que no se encuentran en libro de ventas', value: `${rg90Summary?.no_en_libro ?? 0}`, color: COLOR_CATEGORIA[CATEGORIA.NO_EXISTE_EN_LIBRO] },
    { key: CATEGORIA.DIF_IMPORTE, label: 'Diferencia de Importe', value: `${rg90Summary?.diferencia_importe ?? 0}`, color: COLOR_CATEGORIA[CATEGORIA.DIF_IMPORTE] },
    { key: CATEGORIA.DIF_TASAS, label: 'Diferencia de tasas', value: `${rg90Summary?.diferencias_tasas ?? 0}`, color: COLOR_CATEGORIA[CATEGORIA.DIF_TASAS] },
    // Homologado con el resto de las pestañas (antes "Anulados" era un contador de solo
    // lectura en RG90View.tsx, sin onClick ni filtro propio) -- mismo color que ya usa el
    // chip "Anulada" en la grilla (#5b3aa8, ver filteredRg90Diff en este mismo archivo).
    { key: 'Anulada', label: 'Anulados', value: `${rg90Summary?.anuladas ?? 0}`, color: '#5b3aa8' },
  ];

  const hasAnyUpload = uploadedFiles.length > 0;
  const isFreshStart = !hasAnyUpload && !converted;

  // El Paso 1 ya no pide elegir el sistema antes de adjuntar — se etiqueta 'auto' y el
  // backend detecta, por archivo, cuál de los perfiles conocidos (Aloha/Hiopos/Universal)
  // corresponde (ver doConvert). sistemaLabel queda como "Detectando…" hasta que se analiza.
  const handleFileUpload = (files: FileList) => {
    const newFiles: UploadedFileMeta[] = Array.from(files).map(f => ({
      id: Date.now() + Math.random(),
      sistemaKey: 'auto',
      fileName: f.name,
      uploadedAt: 'hace un momento',
      rawFile: f,
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeAllFiles = () => {
    if (uploadedFiles.length === 0) return;
    setConfirmModal({
      message: `¿Eliminar los ${uploadedFiles.length} archivos adjuntados? Vas a tener que volver a cargarlos.`,
      confirmLabel: 'Eliminar todos',
      onConfirm: () => setUploadedFiles([]),
    });
  };

  const simulateUpload = () => {
    const meta = SYSTEMS_META.find(s => s.key === selectedSystemKey) || SYSTEMS_META[0];
    const n = uploadedFiles.filter(f => f.sistemaKey === meta.key).length + 1;
    setUploadedFiles(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        sistemaKey: meta.key,
        fileName: `Reporte_${meta.label}_${n}.xlsx`,
        uploadedAt: 'hace un momento',
      },
    ]);
  };

  // El local de cada comprobante se determina comparando el PAR establecimiento+punto de
  // expedición (los primeros 6 dígitos del número de documento, ej. "025-001" en
  // 025-001-0065027) contra los locales registrados en la pantalla de administración — no
  // por lo que se haya escrito al subir el archivo. Hace falta el par completo, no solo el
  // establecimiento: un mismo establecimiento puede repartirse entre locales distintos
  // según el punto de expedición (ej. "024-001"/"024-002" = Juan Valdez Hotel, pero
  // "024-003" = Juan Valdez Caja Móvil). Si ningún local activo matchea, la columna queda
  // vacía en el Paso 2 (no se inventa un nombre).
  const resolveLocal = (doc: string): string => {
    const match = locales.find(l => l.estado === 'activo' && l.establecimiento && l.punto_expedicion && doc.startsWith(`${l.establecimiento}-${l.punto_expedicion}`));
    return match ? match.nombre : '';
  };

  const doConvert = async () => {
    if (converted) {
      setShowLockedModal(true);
      return;
    }

    const archivosReales = uploadedFiles.filter(f => f.rawFile).map(f => f.rawFile as File);
    if (archivosReales.length === 0) {
      setConvertError('No hay archivos reales adjuntados para procesar. Adjuntá un reporte de Aloha, Hiopos o del Formato Universal.');
      return;
    }

    setConverting(true);
    setConvertError(null);
    setRg90DuplicadosError(null);
    // Total aproximado (SheetJS, en el navegador) para el indicador "Procesados: X de Y" --
    // ver contarFilasAproximado. Puramente visual, no participa en ninguna regla de negocio.
    const totalAprox = await contarFilasAproximado(archivosReales);
    setLibroProgress({ percent: 0, total: totalAprox });
    try {
      // Un solo pedido para todos los archivos — ya no hace falta agruparlos por sistema
      // de antemano: el backend detecta, por archivo, cuál de los perfiles conocidos
      // corresponde (ver /api/ingest y archivos_detectados en la respuesta). Peso 80% del
      // indicador de avance -- es la parte más pesada (lectura/parseo real del Excel).
      const resultado = await ejecutarConAvance(
        (onUploadProgress) => ingestFilesApi(archivosReales, 'auto', 'Local General', onUploadProgress),
        (f) => setLibroProgress(p => (p ? { ...p, percent: f * 80 } : p)),
      );
      const rows = resultado.rows || [];
      const gaps = resultado.gaps || [];
      const cortes = resultado.cortes || [];
      const rowsConLocal = rows.map(r => ({ ...r, local: resolveLocal(r.doc) }));
      const gapsConLocal = gaps.map(g => ({ ...g, local: resolveLocal(g.ultimo) }));
      setLibroRows(rowsConLocal);
      setCorrelatividadRows(gapsConLocal);
      setCortesRows(cortes);
      setLoteId(resultado.lote_id);

      // Completa, por archivo, el sistema que detectó el backend — el campo queda
      // "apagado" en el Paso 1, solo para mostrar qué se reconoció (ver CargaView).
      if (resultado.archivos_detectados) {
        const porArchivo = new Map(resultado.archivos_detectados.map(a => [a.archivo, a]));
        setUploadedFiles(prev => prev.map(f => {
          const detectado = porArchivo.get(f.fileName);
          return detectado ? { ...f, sistemaKey: detectado.sistema_key, sistemaLabel: detectado.sistema_label } : f;
        }));
      }

      if (rows.length === 0) {
        // Antes esto solo mostraba el error y seguía de largo hasta setConverted(true) más
        // abajo, dejando avanzar al Paso 2 con un libro vacío igual (asimetría real: Compras
        // sí bloquea este mismo caso, ver ComprasView.tsx). El "return" corta acá -- el
        // finally de abajo sigue limpiando converting/libroProgress igual.
        setConvertError('El servidor procesó el/los archivo(s) pero no encontró ningún comprobante válido. Revisá que sea el reporte correcto (hoja "tal como se descarga del sistema", sin editar a mano).');
        return;
      }

      // Validación de duplicados del Libro, apenas se convierte -- no espera a que se
      // adjunte la RG90 ni a "Analizar y comparar" (ver validarDuplicadosLibroApi). Peso 20%
      // restante del indicador de avance. Try/catch propio: un duplicado (o cualquier otro
      // problema de ESTA validación en particular) no debe pisar convertError ni impedir que
      // la conversión se dé por terminada -- la conversión en sí ya funcionó bien, esto es un
      // chequeo aparte que se suma. Si esta validación falla por un motivo QUE NO sea
      // duplicados (red, formato raro, etc.), se ignora en silencio acá: analyzeRg90 vuelve a
      // correr la misma validación más adelante y ahí sí se muestra cualquier error real.
      let duplicadoDetectado: ComprobantesDuplicadosError | null = null;
      if (rowsConLocal.length > 0) {
        try {
          await ejecutarConAvance(
            (onUploadProgress) => validarDuplicadosLibroApi(rowsConLocal, onUploadProgress),
            (f) => setLibroProgress(p => (p ? { ...p, percent: 80 + f * 20 } : p)),
          );
        } catch (e) {
          if (esCancelacion(e)) throw e;
          if (e instanceof ReconcileDuplicadosError) duplicadoDetectado = e.payload;
        }
      }

      // Recién con el archivo COMPLETAMENTE analizado (conversión + chequeo de duplicados)
      // se completa la barra al 100%, se espera un instante para que se perciba como
      // terminada, y solo entonces se revela el resultado (Paso 2) y/o el modal de
      // duplicados -- mientras tanto, el overlay de progreso es lo único visible.
      setLibroProgress(p => (p ? { ...p, percent: 100 } : p));
      await new Promise(resolve => setTimeout(resolve, 350));

      setConverted(true);
      setCargaUploaderOpen(false);
      setPage(1);
      if (duplicadoDetectado) setRg90DuplicadosError(duplicadoDetectado);
    } catch (e) {
      // Cancelado a propósito por el usuario: no es un error, se vuelve al estado previo.
      if (!esCancelacion(e)) {
        setConvertError(e instanceof Error ? e.message : 'Error al procesar los archivos en el servidor.');
      }
      // No avanzamos a "convertido": mejor mostrar el error y dejar reintentar que
      // mostrar datos de ejemplo como si fueran el resultado real.
    } finally {
      setConverting(false);
      setLibroProgress(null);
    }
  };

  const simulateRg90Upload = () => {
    // Sin uso en producción: el input real de archivo ya llama a handleRg90FileUpload.
  };

  const handleRg90FileUpload = (files: FileList) => {
    if (files.length > 0) {
      // Convertir a array acá afuera, antes del updater — ver el mismo comentario en
      // ComprasView.handleRgFileInput. Hoy no rompe porque este input no resetea su value,
      // pero es frágil dejarlo así.
      const nuevos = Array.from(files);
      setRg90Files(prev => [...prev, ...nuevos]);
      setRg90Attached(true);
      setRg90Error(null);
      // Se limpia cualquier resultado de una carga anterior -- el archivo nuevo todavía no
      // se analizó, así que no puede quedar mostrando duplicados de un archivo reemplazado.
      setRg90DuplicadosError(null);
      // A propósito, NO se dispara ningún análisis acá: adjuntar el archivo solo lo agrega
      // a la lista. Antes esto arrancaba automáticamente una validación de duplicados en
      // segundo plano (con su propia barra de progreso) apenas se elegía el archivo -- a
      // pedido explícito, ese análisis pasa a correr ÚNICAMENTE cuando el usuario presiona
      // "Analizar y comparar" (ver analyzeRg90), junto con la comparación, como un solo
      // proceso con una sola pantalla de progreso.
    }
  };

  const quitarRg90Archivo = (index: number) => {
    setRg90Files(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setRg90Attached(false);
      return next;
    });
  };

  const analyzeRg90 = async () => {
    if (!rg90Attached || rg90Files.length === 0) return;
    // Guard defensivo contra un doble click antes de que React llegue a deshabilitar el
    // botón (ver rg90Progress, declarado arriba): si por algún motivo esta función se
    // llamara mientras ya hay un análisis en curso, no arranca una segunda barra encima.
    if (rg90Progress) return;

    setRg90Error(null);
    setRg90DuplicadosError(null);
    // El cerrojo (rg90Progress) se setea ACÁ, antes de contarFilasAproximado (que para un
    // archivo grande puede tardar varios segundos), para no dejar una ventana donde el
    // guard de arriba ya pasó pero el estado compartido todavía es null -- durante esa
    // ventana, un segundo click en "Analizar y comparar" podría arrancar en paralelo y
    // pisar el mismo estado. Un solo mensaje/una sola barra para TODO el proceso: leer y
    // analizar la RG90 (duplicados incluidos) Y compararla contra el libro son, de cara al
    // usuario, un único paso -- lo hace todo /api/reconcile en un solo pedido (ver
    // reconcileApi), así que nunca hay dos pantallas para esto, a pedido explícito.
    setRg90Progress({ percent: 0, total: 0, message: 'Analizando y comparando contra la RG90…' });
    const totalAprox = (await contarFilasAproximado(rg90Files)) + libroRows.length;
    setRg90Progress(p => (p ? { ...p, total: totalAprox } : p));

    let duplicadoDetectado: ComprobantesDuplicadosError | null = null;
    let errorGenerico: string | null = null;
    try {
      const res = await ejecutarConAvance(
        (onUploadProgress) => reconcileApi(rg90Files, libroRows, loteId, onUploadProgress),
        (f) => setRg90Progress(p => (p ? { ...p, percent: f * 100 } : p)),
      );
      setRg90DiffRows(res.diffs || []);
      setRg90Rows(res.rg90_rows || []);
      setRg90GapsRows(res.rg90_gaps || []);
      setRg90GridPage(1);
      setRg90Summary({
        coinciden: res.summary?.coinciden ?? 0,
        no_en_rg90: res.summary?.no_en_rg90 ?? 0,
        no_en_libro: res.summary?.no_en_libro ?? 0,
        saltos: res.summary?.saltos ?? 0,
        diferencia_importe: res.summary?.diferencia_importe ?? 0,
        diferencias_tasas: res.summary?.diferencias_tasas ?? 0,
        anuladas: res.summary?.anuladas ?? 0,
      });
      setRg90Loaded(true);
      // Se queda en el Paso 3, listando los registros de la RG90 — el usuario avanza al
      // Paso 4 con "Siguiente" cuando quiera ver el resultado, igual que Compras.
    } catch (e) {
      if (e instanceof ReconcileDuplicadosError) {
        duplicadoDetectado = e.payload;
      } else if (!esCancelacion(e)) {
        errorGenerico = e instanceof Error ? e.message : 'Error al ejecutar la comparación RG90.';
      }
    }

    // Mismo criterio que doConvert/handleRg90FileUpload: completar la barra, dejarla un
    // instante como terminada, ocultarla, y RECIÉN AHÍ mostrar el error o el modal de
    // duplicados -- nunca superpuestos con el indicador de avance.
    setRg90Progress(p => (p ? { ...p, percent: 100 } : p));
    await new Promise(resolve => setTimeout(resolve, 350));
    setRg90Progress(null);
    if (duplicadoDetectado) setRg90DuplicadosError(duplicadoDetectado);
    if (errorGenerico) setRg90Error(errorGenerico);
  };

  const resetRg90 = () => {
    setConfirmModal({
      message: '¿Quitar el archivo RG90 cargado? Se perderá el resultado de la comparación.',
      confirmLabel: 'Quitar archivo',
      onConfirm: () => {
        setRg90Loaded(false);
        setRg90Attached(false);
        setRg90Files([]);
        setRg90DiffRows([]);
        setRg90Summary(null);
        setRg90Error(null);
        setRg90Rows([]);
        setRg90GapsRows([]);
        setRg90GridColFiltros({});
        navigate('/ventas/rg90/adjuntar');
      },
    });
  };

  const deleteLibro = () => {
    setConfirmModal({
      message: '¿Borrar el libro de ventas? También se borrará el análisis y el archivo RG90 cargado.',
      confirmLabel: 'Borrar libro',
      onConfirm: () => {
        setConverted(false);
        setLibroRows([]);
        setLibroColFiltros({});
        setCorrelatividadRows([]);
        setCortesRows([]);
        setRg90Loaded(false);
        setRg90Attached(false);
        setRg90Files([]);
        setRg90DiffRows([]);
        setRg90Summary(null);
        setRg90Error(null);
        setRg90Rows([]);
        setRg90GapsRows([]);
        setRg90GridColFiltros({});
        setCargaUploaderOpen(true);
      },
    });
  };

  // Formato de columnas y resumen tomados 1:1 de la hoja "LIBRO VENTAS GLOBAL-Fact-NC" del
  // archivo de referencia del cliente (Libro Ventas Mes de Mayo 2026 ACDG v2.xlsx): fila
  // TOTAL pegada al final de los datos, y m\u00E1s abajo un bloque RESUMEN con el total de
  // Factura, el de Nota de Cr\u00E9dito, el NETO (suma de ambos) y un Check de redondeo.
  // Recibe las filas a exportar en vez de leer libroRows directo: CargaView (Paso 2) pasa
  // filteredLibro y LibroCompletoView pasa su propia lista (filteredLibro + la búsqueda de
  // esa pantalla) — cada una "lo que se ve en su grilla" en ese momento. Si no hay ningún
  // filtro activo, esas listas ya son iguales a libroRows completo.
  // Antes usaba downloadExcel (SheetJS, arma el .xlsx completo en el navegador de forma
  // síncrona) — medido: 4,25s bloqueado con 20.000 filas, y con los archivos reales del
  // cliente (50.000-100.000+) esto escala mucho peor o directamente cuelga el navegador
  // (mismo problema ya documentado y resuelto para el Detalle de Discrepancias de Ventas,
  // nunca extendido acá). Se cambia a exportarTablaExcelApi (backend, streaming,
  // openpyxl write_only) — mismo endpoint ya probado que usa RG90View para su propia
  // grilla. Ningún dato ni cálculo cambia: se le mandan las mismas filas ya armadas
  // (dataRows + totales/resumen), el backend solo arma el archivo en vez del navegador.
  // Mismo criterio que exportandoRg90/exportandoDiff en RG90View.tsx: mientras el backend
  // arma el archivo (puede ser un rato real con archivos grandes), el botón muestra
  // "Generando Excel…" y queda deshabilitado, para que el usuario sepa que está
  // procesando y no dispare varios pedidos a la vez a fuerza de clickear de nuevo.
  const [descargandoLimpio, setDescargandoLimpio] = useState(false);
  const downloadLimpio = async (rows: LibroRow[]) => {
    if (descargandoLimpio) return;
    setDescargandoLimpio(true);
    const headers = ['Proyecto', 'Factura', 'Tipo Doc.', 'Fecha', 'Ruc', 'Nombre', 'Gravadas 10%', 'IVA 10%', 'Gravadas 5%', 'IVA 5%', 'Exentas', 'Total Neto', 'Estado'];
    // Los importes van con el mismo texto ya formateado que se ve en la grilla (r.gravadas,
    // no r.gravadas_num) — así el Excel descargado coincide con la pantalla tal cual, sin
    // arriesgar que se invierta coma y punto al re-formatear un number.
    const dataRows = rows.map(r => [
      r.local, r.doc, r.tipo_doc ?? 'Factura', r.fecha, r.ruc, r.nombre,
      r.gravadas, r.iva, r.gravadas_5 ?? '0,00', r.iva_5 ?? '0,00', r.exentas, r.total, r.estado,
    ]);

    const sumFields = (pred: (r: LibroRow) => boolean) => {
      const subset = rows.filter(pred);
      const sum = (f: (r: LibroRow) => number | undefined) => subset.reduce((acc, r) => acc + (f(r) ?? 0), 0);
      return {
        gravada10: sum(r => r.gravadas_num), iva10: sum(r => r.iva_num),
        gravada5: sum(r => r.gravadas_5_num), iva5: sum(r => r.iva_5_num),
        exentas: sum(r => r.exentas_num), total: sum(r => r.total_num),
      };
    };
    const totalGeneral = sumFields(() => true);
    const totalFactura = sumFields(r => (r.tipo_doc ?? 'Factura') === 'Factura');
    const totalNC = sumFields(r => r.tipo_doc === 'Nota de Cr\u00E9dito');
    const neto = {
      gravada10: totalFactura.gravada10 + totalNC.gravada10,
      iva10: totalFactura.iva10 + totalNC.iva10,
      gravada5: totalFactura.gravada5 + totalNC.gravada5,
      iva5: totalFactura.iva5 + totalNC.iva5,
      exentas: totalFactura.exentas + totalNC.exentas,
      total: totalFactura.total + totalNC.total,
    };
    const check = neto.total - totalGeneral.total;

    // Los cortes/subtotales que el propio reporte de origen imprim\u00EDa quedaron guardados en
    // memoria (cortesRows) para poder cotejarlos manualmente contra lo calculado ac\u00E1; se
    // dejan en consola en vez de un chequeo autom\u00E1tico porque cada archivo repite el corte
    // una vez por nivel (serie, resoluci\u00F3n, tipo), as\u00ED que no hay una \u00FAnica cifra 1:1 contra
    // la cual comparar de forma confiable.
    if (cortesRows.length > 0) {
      console.info('[libro limpio] cortes/subtotales del reporte original disponibles para cotejar:', cortesRows);
    }

    // Los totales/resumen s\u00ED se calculan ac\u00E1 (son agregados que no vienen del backend), pero
    // se formatean con el mismo criterio ("18.891.429,00") antes de escribirlos \u2014 nunca se
    // dejan como number en la celda.
    const totalRow = ['', '', '', '', '', 'TOTAL', formatGs(totalGeneral.gravada10), formatGs(totalGeneral.iva10), formatGs(totalGeneral.gravada5), formatGs(totalGeneral.iva5), formatGs(totalGeneral.exentas), formatGs(totalGeneral.total), ''];
    const blank = ['', '', '', '', '', '', '', '', '', '', '', '', ''];
    const resumenHeader = ['', '', '', '', '', 'RESUMEN', '', '', '', '', '', '', ''];
    const facturaRow = ['', '', '', '', '', 'Factura', formatGs(totalFactura.gravada10), formatGs(totalFactura.iva10), formatGs(totalFactura.gravada5), formatGs(totalFactura.iva5), formatGs(totalFactura.exentas), formatGs(totalFactura.total), ''];
    const ncRow = ['', '', '', '', '', 'Nota de Cr\u00E9dito', formatGs(totalNC.gravada10), formatGs(totalNC.iva10), formatGs(totalNC.gravada5), formatGs(totalNC.iva5), formatGs(totalNC.exentas), formatGs(totalNC.total), ''];
    const netoRow = ['', '', '', '', '', 'NETO', formatGs(neto.gravada10), formatGs(neto.iva10), formatGs(neto.gravada5), formatGs(neto.iva5), formatGs(neto.exentas), formatGs(neto.total), ''];
    const checkRow = ['', '', '', '', '', 'Check', '', '', '', '', '', formatGs(check), ''];

    try {
      await exportarTablaExcelApi('Libro_Ventas_Global_formato_limpio.xlsx', 'Libro de Ventas', headers, [
        ...dataRows, totalRow,
        blank, blank, blank,
        resumenHeader, blank, facturaRow, ncRow, netoRow, checkRow,
      ]);
    } catch (e) {
      console.error('Error al exportar el Libro de Ventas a Excel:', e);
    } finally {
      setDescargandoLimpio(false);
    }
  };

  // Guidance texts and wizard steps
  let nextCtaLabel = 'Ir a cargar reportes';
  let nextCtaAction = () => navigate('/ventas/carga');
  let guidanceText = 'Todavía no cargaste ningún reporte.';

  if (hasAnyUpload && !converted) {
    nextCtaLabel = 'Analizar y convertir';
    nextCtaAction = () => navigate('/ventas/carga');
    guidanceText = 'Ya cargaste reportes. Analizalos y convertilos para generar el libro de ventas.';
  } else if (converted && !rg90Loaded) {
    nextCtaLabel = 'Cargar y comparar RG90';
    nextCtaAction = () => navigate('/ventas/rg90/adjuntar');
    guidanceText = 'El libro de ventas ya está listo. Cargá el archivo RG90 para comparar.';
  } else if (converted && rg90Loaded) {
    nextCtaLabel = 'Ver comparación';
    nextCtaAction = () => navigate('/ventas/rg90/resultado');
    guidanceText = 'Todo listo — revisá el resultado de la comparación.';
  }

  const stepStatus = (done: boolean, unlocked: boolean) => (done ? 'done' : unlocked ? 'active' : 'locked');
  const dashboardSteps = [
    { n: 1, label: 'Cargar los reportes que desea analizar y consolidar', status: stepStatus(hasAnyUpload, true) },
    { n: 2, label: 'Analizar y convertir al formato limpio', status: stepStatus(converted, hasAnyUpload) },
    { n: 3, label: 'Cargar el archivo RG90 y comparar', status: stepStatus(rg90Loaded, converted) },
  ].map(st => ({
    ...st,
    circleStyle: st.status === 'done' ? 'background:#128752;color:#fff' : st.status === 'active' ? 'background:#f0a63d;color:#1a1a1a' : 'background:#eceae4;color:#9aa1ab',
    mark: st.status === 'done' ? '✓' : String(st.n),
    statusText: st.status === 'done' ? 'Completado' : st.status === 'active' ? 'Siguiente paso' : 'Bloqueado',
    statusTextStyle: st.status === 'done' ? 'color:#128752' : st.status === 'active' ? 'color:#b0740f' : 'color:#9aa1ab',
  }));

  // Paso 3 (Adjuntar RG90 y listar) y Paso 4 (Resultado) viven en la misma pantalla
  // ('rg90'), distinguidos por rg90PasoMostrado — igual que Compras separa sus 3 pasos
  // dentro de una sola vista. current se calcula por pantalla+estado, no solo por
  // converted/rg90Loaded, para que el paso activo refleje dónde está el usuario de verdad.
  const wizardSteps = [
    { n: 1, label: 'Cargar reportes' },
    { n: 2, label: 'Datos comparados' },
    { n: 3, label: 'Adjuntar RG90' },
    { n: 4, label: 'Resultados' },
  ].map(st => {
    // "active" (en qué paso está parado el usuario ahora mismo) sigue dependiendo de la
    // pantalla actual — eso está bien. Pero "reachable" (si puede saltar directo a un
    // paso haciendo click) y "done" (el ✓ verde) NO deben depender de screen/pantalla
    // actual, solo de si esos datos ya existen — si dependieran de la pantalla actual,
    // volver a "Cargar reportes" después de haber comparado todo hacía que los pasos 3 y
    // 4 se vieran bloqueados de nuevo aunque ya estuvieran hechos, y el usuario no podía
    // saltar directo a ellos sin repetir "Siguiente" paso por paso.
    // Antes acá adentro se asumía "si ya comparaste (rg90Loaded), tenés que estar viendo
    // el paso 4" — pero el paso 3 (Adjuntar RG90) sigue existiendo y se puede volver a
    // visitar aunque ya haya un resultado, así que hay que mirar rg90PasoMostrado (el
    // paso real que se está mostrando en la pantalla 'rg90') en vez de inferirlo. Sin
    // esto, un click en "Resultados" no hacía nada (quedaba marcado "activo" aunque la
    // grilla mostrara el paso 3) y un click en "Adjuntar RG90" dejaba la barra marcando
    // "Resultados" mientras la grilla mostraba el paso 3 — la barra y la pantalla real
    // podían quedar desincronizadas.
    const current = !converted ? 1 : screen !== 'rg90' ? (cargaUploaderOpen ? 1 : 2) : rg90PasoMostrado === 3 ? 3 : 4;
    const active = st.n === current;
    // Paso 1/2 (Cargar/Datos comparados) viven en la misma pantalla (CargaView, que ya
    // decide sola si mostrar el uploader o la grilla según converted) — siempre se puede
    // ir ahí. Paso 3 (Adjuntar RG90) requiere tener ya un libro armado; Paso 4
    // (Resultados) requiere que la comparación ya se haya corrido.
    const reachable = st.n <= 2 ? true : st.n === 3 ? converted : rg90Loaded;
    const done = !active && (st.n <= 2 ? converted : rg90Loaded);
    return {
      ...st,
      circleStyle: (done ? 'background:#128752;color:#fff' : active ? 'background:#f0a63d;color:#1a1a1a' : 'background:#e5e2da;color:#9aa1ab') + (reachable && !active ? ';cursor:pointer' : ';cursor:default'),
      labelStyle: (active ? 'color:#22262b;font-weight:700' : done ? 'color:#128752;font-weight:600' : 'color:#9aa1ab') + (reachable && !active ? ';cursor:pointer' : ''),
      mark: done ? '✓' : String(st.n),
      // CargaView decide sola si mostrar el uploader (Paso 1) o la grilla (Paso 2) según
      // cargaUploaderOpen, no según screen — si ya estaba convertido y cargaUploaderOpen
      // había quedado en false (ver doConvert), un click en "1. Cargar reportes" con solo
      // navigate('/ventas/carga') no cambiaba nada (ya estaba en esa URL) y seguía
      // mostrando la grilla en vez del uploader. Hay que forzar el flag explícitamente en
      // cada caso.
      goTo: !reachable || active ? undefined : () => {
        if (st.n === 1) { navigate('/ventas/carga'); setCargaUploaderOpen(true); }
        else if (st.n === 2) { navigate('/ventas/carga'); setCargaUploaderOpen(false); }
        else if (st.n === 3) navigate('/ventas/rg90/adjuntar');
        else navigate('/ventas/rg90/resultado');
      },
    };
  });

  // Table filtering and pagination
  //
  // Mismo hallazgo F2/F4 que ya se corrigió para RG90 (/auditoria/05-performance.md), acá
  // extendido: el buscador del Libro de Ventas (Paso 2) nunca recibió el useDeferredValue
  // que sí tiene el de RG90 — cada tecla disparaba el filtro completo sobre libroRows de
  // forma síncrona.
  const searchGeneralDeferred = useDeferredValue(searchGeneral);
  const libroCompletoSearchDeferred = useDeferredValue(libroCompletoSearch);

  // Hallazgo F4 (mismo que filteredRg90Rows/rg90GridTotales, nunca extendido a esta
  // grilla): filteredLibro era un `let` reasignado varias veces, SIN useMemo — se
  // recalculaba entero (recorriendo todo libroRows) en CADA render de App.tsx, sin
  // importar si la pantalla activa era Carga, RG90, Compras o cualquier otra. Esto es lo
  // que causaba el congelamiento al cambiar de paso y la lentitud al terminar de cargar un
  // Excel grande: App.tsx se re-renderiza en cada navegación, y este cálculo se repetía
  // completo cada vez, aunque la pantalla nueva ni lo necesitara.
  const filteredLibro = useMemo(() => {
    let lista = libroRows.filter(r => matchesSistema(r.sistema, filtro));
    if (estadoFilter) lista = lista.filter(r => r.estado === estadoFilter);
    for (const col of LIBRO_COLUMNAS) {
      const activo = libroColFiltros[col.key];
      if (activo) lista = lista.filter(r => activo.has(col.getValue(r)));
    }
    if (searchGeneralDeferred.trim()) {
      const q = searchGeneralDeferred.trim().toLowerCase();
      lista = lista.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }
    return lista;
  }, [libroRows, filtro, estadoFilter, libroColFiltros, searchGeneralDeferred]);

  // Pantalla "Ver todos" (libroCompleto): mismos filtros de arriba (filteredLibro) más su
  // propio buscador — se usa tanto para lo que se lista como para lo que se descarga, así
  // el Excel siempre coincide con lo que esa pantalla está mostrando. Mismo criterio F4:
  // memoizado, y con el buscador propio también diferido (F2) — esta pantalla es
  // justamente la que muestra el libro COMPLETO sin paginar, así que es la más costosa de
  // recalcular en cada tecla.
  const libroCompletoFiltrado = useMemo(() => filteredLibro.filter(r =>
    !libroCompletoSearchDeferred.trim() ||
    Object.values(r).some(v => String(v).toLowerCase().includes(libroCompletoSearchDeferred.trim().toLowerCase()))
  ), [filteredLibro, libroCompletoSearchDeferred]);

  // Mismo criterio que rg90GridAllValuesPorColumna más abajo (ver hallazgo F1 de
  // /auditoria/05-performance.md): allValues memoizado por separado, dependiendo solo de
  // libroRows — evita recalcular el Set+sort de valores únicos de las 14 columnas en cada
  // render (tipear en cualquier buscador de la pantalla, abrir un dropdown, etc.), y le da
  // a ExcelFilterHeader una referencia de array estable para que su propio useMemo interno
  // funcione de verdad. Este es el Paso 1/2 (Libro de Ventas) — mismo volumen que la
  // grilla de RG90 ya corregida, y es el primer paso del flujo, así que se usa siempre.
  const libroAllValuesPorColumna = useMemo(
    () => Object.fromEntries(LIBRO_COLUMNAS.map(col => [col.key, libroRows.map(col.getValue)])),
    [libroRows]
  );

  const libroColumnFilters = LIBRO_COLUMNAS.map(col => ({
    key: col.key,
    label: col.label,
    allValues: libroAllValuesPorColumna[col.key],
    active: libroColFiltros[col.key] ?? null,
    onChange: (next: Set<string> | null) => { setLibroColFiltros(prev => ({ ...prev, [col.key]: next })); setPage(1); },
  }));
  const hayLibroColFiltrosActivos = Object.values(libroColFiltros).some(v => v !== null && v !== undefined);
  const limpiarLibroColFiltros = () => { setLibroColFiltros({}); setPage(1); };

  // Totalizador sobre TODO lo filtrado (tabs de sistema + filtros de columna + buscador),
  // no solo la página visible — para que el total acompañe al filtro, no a la paginación.
  // Mismo hallazgo F4 que rg90GridTotales: 6 pasadas de reduce() sin memoizar.
  const libroTotales = useMemo(() => ({
    gravadas: filteredLibro.reduce((s, r) => s + (r.gravadas_num || 0), 0),
    iva: filteredLibro.reduce((s, r) => s + (r.iva_num || 0), 0),
    gravadas_5: filteredLibro.reduce((s, r) => s + (r.gravadas_5_num || 0), 0),
    iva_5: filteredLibro.reduce((s, r) => s + (r.iva_5_num || 0), 0),
    exentas: filteredLibro.reduce((s, r) => s + (r.exentas_num || 0), 0),
    total: filteredLibro.reduce((s, r) => s + (r.total_num || 0), 0),
  }), [filteredLibro]);

  const totalPages = Math.max(1, Math.ceil(filteredLibro.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pagedLibro = filteredLibro.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(r => ({
    ...r,
    estadoStyle: r.estado === 'Anulada' ? 'background:#fbe9e3;color:#b3402f;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px' : 'background:#e8f3ec;color:#128752;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px',
  }));

  // Grilla del Paso 3 (Adjuntar RG90) — mismos filtros/columnas/totalizador que la del
  // Paso 2, reutilizando LIBRO_COLUMNAS porque rg90Rows tiene la misma forma (LibroRow[]).
  //
  // allValues por columna, memoizado por SEPARADO del resto (dependencia: solo rg90Rows,
  // que es lo único de lo que depende el valor en sí) — ver /auditoria/05-performance.md,
  // hallazgo de frontend F1. Antes, `rg90Rows.map(col.getValue)` se recalculaba inline en
  // cada render, lo que le pasaba un array nuevo a ExcelFilterHeader en cada vuelta; su
  // useMemo interno (dependencia [allValues]) nunca encontraba una dependencia "igual" por
  // referencia y terminaba recalculando el Set+sort de valores únicos igual, en las 14
  // columnas, en cada render — 4 segundos medidos con 97.851 filas. Memoizando acá, con
  // rg90Rows como única dependencia real, ExcelFilterHeader vuelve a recibir la MISMA
  // referencia de array entre renders mientras rg90Rows no cambie, y su propio useMemo
  // empieza a funcionar de verdad (no hizo falta tocar ese componente).
  const rg90GridAllValuesPorColumna = useMemo(
    () => Object.fromEntries(LIBRO_COLUMNAS.map(col => [col.key, rg90Rows.map(col.getValue)])),
    [rg90Rows]
  );

  // Buscador del Paso 3: useDeferredValue en vez de debounce manual — la tecla en sí (el
  // <input value={rg90GridSearch}>, sin cambios, en RG90View.tsx) sigue actualizándose al
  // instante; el filtrado de abajo (que usa este valor diferido) se aplica un toque
  // después, en un render de baja prioridad que no bloquea el repintado del input mientras
  // se tipea. Ver hallazgo F2 en /auditoria/05-performance.md — antes, cada tecla disparaba
  // el filtro sobre las 97.851 filas de forma síncrona (344 ms medidos por sí solo, sumado
  // al costo de F1 arriba).
  const rg90GridSearchDeferred = useDeferredValue(rg90GridSearch);

  // Hallazgo F4 de /auditoria/05-performance.md: filteredRg90Rows en sí no estaba en la
  // lista de cálculos a corregir, pero rg90GridTotales (sí listado) depende de él — si
  // filteredRg90Rows sigue siendo un array nuevo en cada render, memoizar rg90GridTotales
  // por separado no serviría de nada (mismo problema de referencia inestable que F1).
  // Dependencias: rg90Rows (estado), rg90GridColFiltros (estado), rg90GridSearchDeferred
  // (ya es un valor estable, diferido con useDeferredValue desde F2) — las tres cambian de
  // referencia solo cuando realmente cambia lo que representan, no en cada render.
  const filteredRg90Rows = useMemo(() => {
    let lista = rg90Rows;
    for (const col of LIBRO_COLUMNAS) {
      const activo = rg90GridColFiltros[col.key];
      if (activo) lista = lista.filter(r => activo.has(col.getValue(r)));
    }
    if (rg90GridSearchDeferred.trim()) {
      const q = rg90GridSearchDeferred.trim().toLowerCase();
      lista = lista.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }
    return lista;
  }, [rg90Rows, rg90GridColFiltros, rg90GridSearchDeferred]);
  const rg90GridColumnFilters = LIBRO_COLUMNAS.map(col => ({
    key: col.key,
    label: col.label,
    allValues: rg90GridAllValuesPorColumna[col.key],
    active: rg90GridColFiltros[col.key] ?? null,
    onChange: (next: Set<string> | null) => { setRg90GridColFiltros(prev => ({ ...prev, [col.key]: next })); setRg90GridPage(1); },
  }));
  const hayRg90GridColFiltrosActivos = Object.values(rg90GridColFiltros).some(v => v !== null && v !== undefined);
  const limpiarRg90GridColFiltros = () => { setRg90GridColFiltros({}); setRg90GridPage(1); };
  // Hallazgo F4, punto 3 (/auditoria/05-performance.md) — 6 pasadas de reduce() sin
  // memoizar, sobre filteredRg90Rows (ya memoizado arriba).
  const rg90GridTotales = useMemo(() => ({
    gravadas: filteredRg90Rows.reduce((s, r) => s + (r.gravadas_num || 0), 0),
    iva: filteredRg90Rows.reduce((s, r) => s + (r.iva_num || 0), 0),
    gravadas_5: filteredRg90Rows.reduce((s, r) => s + (r.gravadas_5_num || 0), 0),
    iva_5: filteredRg90Rows.reduce((s, r) => s + (r.iva_5_num || 0), 0),
    exentas: filteredRg90Rows.reduce((s, r) => s + (r.exentas_num || 0), 0),
    total: filteredRg90Rows.reduce((s, r) => s + (r.total_num || 0), 0),
  }), [filteredRg90Rows]);
  const rg90GridTotalPages = Math.max(1, Math.ceil(filteredRg90Rows.length / pageSize));
  const rg90GridCurrentPage = Math.min(Math.max(1, rg90GridPage), rg90GridTotalPages);
  const pagedRg90Rows = filteredRg90Rows.slice((rg90GridCurrentPage - 1) * pageSize, rg90GridCurrentPage * pageSize);

  // Mismo hallazgo F4: filtro sobre correlatividadRows sin memoizar, recalculado en cada
  // render de App.tsx sin importar la pantalla activa.
  const filteredCorrel = useMemo(
    () => correlatividadRows.filter(r => matchesSistema(r.sistema, correlFiltro)),
    [correlatividadRows, correlFiltro]
  );

  // Estado de ingesta por sistema origen: calculado de los datos reales del libro
  // cargado, no valores fijos — refleja exactamente lo que se subió y proceso.
  //
  // Mismo hallazgo F4: recorre libroRows completo (varias veces, una por sistema) sin
  // memoizar — solo se ve en el Panel general, pero antes se recalculaba igual en
  // cualquier otra pantalla, en cada render de App.tsx.
  const importStatusComputed = useMemo(() => SYSTEMS_META.map(sysMeta => {
    const filasSistema = libroRows.filter(r => matchesSistema(r.sistema, sysMeta.label));
    const localesSistema = new Set(filasSistema.map(r => r.local));
    const saltosSistema = correlatividadRows.filter(r => matchesSistema(r.sistema, sysMeta.label));
    const archivosSistema = uploadedFiles.filter(f => f.sistemaKey === sysMeta.key);
    return {
      sistema: sysMeta.label,
      sistemaKey: sysMeta.key,
      locales: localesSistema.size,
      registros: filasSistema.length.toLocaleString('es-PY'),
      estado: archivosSistema.length > 0 ? 'Cargado' : 'Pendiente',
      ultimaCarga: archivosSistema.length > 0 ? archivosSistema[archivosSistema.length - 1].uploadedAt : '—',
      saltos: saltosSistema.length,
      // Filas detalladas (no solo el conteo) para el modal "Ver saltos" del Panel general
      // — mismo patrón que el modal de saltos de Libro Ventas/Compras (RG90View/ComprasView).
      saltosRows: saltosSistema,
    };
  }), [libroRows, correlatividadRows, uploadedFiles]);

  // Mismo patrón F2 (/auditoria/05-performance.md, ya usado en rg90GridSearchDeferred del
  // Paso 3) — la tecla en sí (el <input value={rg90Search}>, sin cambios, en RG90View.tsx)
  // sigue actualizándose al instante; el filtrado de abajo se aplica en un render de baja
  // prioridad que no bloquea el repintado del input mientras se tipea.
  //
  // Corregido en /auditoria/08-analisis-memoria-lag-global-200k.md: sin esto, cada tecla
  // recalculaba filteredRg90Diff de forma síncrona y bloqueante sobre las 200.000 filas
  // completas (Object.values().some() + spread de hasta 200.000 objetos), y esa nueva
  // referencia de array además invalidaba en cascada filteredRg90DiffCols/diffTotalesVentas
  // en RG90View.tsx — medido: 56-64 segundos de bloqueo del hilo principal por una sola
  // tecla.
  const rg90SearchDeferred = useDeferredValue(rg90Search);

  // Se movió acá desde RG90View.tsx (antes vivía como useMemo local, dependiendo de
  // rg90DiffAll) — ver el comentario en la interfaz de props de RG90View para el porqué:
  // el caché de un useMemo local se pierde cada vez que ese componente se desmonta (ej.
  // volver a "Cargar reportes" y entrar de nuevo a "Resultados"), forzando un recálculo
  // completo de las 21 columnas × todas las filas aunque rg90DiffRows no hubiera cambiado
  // — medido: 27 segundos de bloqueo real con 100.000 filas, solo por ese ciclo de
  // desmontaje/remontaje. Acá en App.tsx (que nunca se desmonta) el mismo cálculo, con la
  // misma dependencia real (rg90DiffRows), sobrevive esos ciclos.
  const diffAllValuesPorColumna = useMemo(
    () => Object.fromEntries(RG90_DIFF_COLUMNAS.map(col => [col.key, rg90DiffRows.map(col.getValue)])),
    [rg90DiffRows]
  );

  // Hallazgo F4, punto 4 (/auditoria/05-performance.md) — filter+filter+map armando un
  // string de estilo por fila, sin memoizar. Dependencias: las tres son estado directo
  // (rg90DiffRows, rg90SearchDeferred, rg90CategoryFilter), sin ningún valor derivado
  // inestable de por medio.
  const filteredRg90Diff = useMemo(() => rg90DiffRows
    .filter(r => !rg90SearchDeferred || Object.values(r).some(v => String(v).toLowerCase().includes(rg90SearchDeferred.toLowerCase())))
    .filter(r => !rg90CategoryFilter || r.diferencia === rg90CategoryFilter)
    .map(r => {
      let diffStyle = 'background:#f0eee8;color:#5c6470;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px';
      if (r.diferencia === 'Coincide') {
        diffStyle = 'background:#e8f3ec;color:#128752;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px';
      } else if (r.diferencia === 'No llegó a la interfaz' || r.diferencia === 'No existe en el libro') {
        diffStyle = 'background:#fbe9e3;color:#b3402f;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px';
      } else if (r.diferencia === 'Rechazada' || r.diferencia === 'Salto de numeración') {
        diffStyle = 'background:#fdf1de;color:#b0740f;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px';
      } else if (r.diferencia === 'Anulada') {
        diffStyle = 'background:#f1eef8;color:#5b3aa8;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px';
      }
      return { ...r, diffChipStyle: diffStyle };
    }), [rg90DiffRows, rg90SearchDeferred, rg90CategoryFilter]);

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
