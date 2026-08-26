import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ConfirmModal } from './components/ConfirmModal';

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

import {
  LibroRow,
  CorrelatividadRow,
  RG90DiffRow,
  CorteRow,
  UploadedFileMeta,
  Local,
  Rol,
  Permiso,
  Usuario,
  MeInfo,
  ingestFilesApi,
  reconcileApi,
  getAuthToken,
  setAuthToken,
  getMeApi,
  listLocalesApi,
  listRolesApi,
  listPermisosApi,
  listUsuariosApi,
} from './services/api';

// Un local/sistema "matchea" un filtro por inclusión, no por igualdad: el backend
// devuelve el nombre completo del perfil (ej. "Aloha POS — Juan Valdez"), no la
// etiqueta corta ("Aloha") que usan los botones de filtro de la UI.
const matchesSistema = (valor: string, filtro: string) =>
  filtro === 'Todos' || (valor || '').toLowerCase().includes(filtro.toLowerCase());

type Screen = 'dashboard' | 'carga' | 'correl' | 'rg90' | 'libroCompleto' | 'compras' | 'locales' | 'usuarios' | 'roles';

// Tipado por Screen (no Record<string, ...>) a propósito: si se agrega una pantalla nueva y
// se olvida su entrada acá, TITLES[screen] da undefined y el destructuring de abajo revienta
// en runtime sin ningún error de compilación — ya pasó una vez con 'compras'. Con este tipo,
// TypeScript obliga a completar las 9 claves.
const TITLES: Record<Screen, [string, string]> = {
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

const SYSTEMS_META = [
  { key: 'aloha', label: 'Aloha', desc: 'Sistema de punto de venta · Juan Valdez' },
  { key: 'hiopos', label: 'Hiopos', desc: 'Sistema de punto de venta · La Cabrera, 100 M y otros' },
  { key: 'universal', label: 'Universal', desc: 'Planilla estándar para locales sin export de Aloha/Hiopos' },
];

// Columnas con filtro tipo Excel en la grilla del libro de ventas unificado (paso 2 de
// Carga). Se dejan afuera los importes (Gravadas/IVA/Exentas/Total): valores casi todos
// distintos entre sí, ahí ya está el buscador general — un listado de checkboxes no ayuda.
const LIBRO_COLUMNAS: { key: string; label: string; getValue: (r: LibroRow) => string }[] = [
  { key: 'doc', label: 'Documento', getValue: r => r.doc },
  { key: 'tipo_doc', label: 'Tipo', getValue: r => r.tipo_doc || 'Factura' },
  { key: 'sistema', label: 'Sistema', getValue: r => r.sistema },
  { key: 'local', label: 'Local', getValue: r => r.local },
  { key: 'fecha', label: 'Fecha', getValue: r => r.fecha },
  { key: 'ruc', label: 'RUC', getValue: r => r.ruc },
  { key: 'nombre', label: 'Nombre', getValue: r => r.nombre },
  { key: 'estado', label: 'Estado', getValue: r => r.estado },
];

export function App() {
  const [authed, setAuthed] = useState<boolean>(!!getAuthToken());
  const [screen, setScreen] = useState<Screen>('dashboard');
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
    getMeApi().then(setMeInfo).catch(() => setMeInfo(null));
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
  const [rg90PasoMostrado, setRg90PasoMostrado] = useState<3 | 4>(3);
  const [rg90Rows, setRg90Rows] = useState<LibroRow[]>([]);
  const [rg90GridSearch, setRg90GridSearch] = useState<string>('');
  const [rg90GridPage, setRg90GridPage] = useState<number>(1);
  const [rg90GridColFiltros, setRg90GridColFiltros] = useState<Record<string, Set<string> | null>>({});

  const [libroRows, setLibroRows] = useState<LibroRow[]>([]);
  const [correlatividadRows, setCorrelatividadRows] = useState<CorrelatividadRow[]>([]);
  const [cortesRows, setCortesRows] = useState<CorteRow[]>([]);
  const [rg90DiffRows, setRg90DiffRows] = useState<RG90DiffRow[]>([]);
  const [rg90Files, setRg90Files] = useState<File[]>([]);
  const [rg90Analyzing, setRg90Analyzing] = useState<boolean>(false);
  const [rg90Error, setRg90Error] = useState<string | null>(null);
  const [rg90Summary, setRg90Summary] = useState<{ coinciden: number; no_en_rg90: number; no_en_libro: number; saltos: number } | null>(null);
  const [loteId, setLoteId] = useState<number | undefined>(undefined);
  const [converting, setConverting] = useState<boolean>(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const rg90CardsState = [
    { key: '', label: 'Coinciden', value: `${rg90Summary?.coinciden ?? 0}`, color: '#128752' },
    { key: 'No llegó a la interfaz', label: 'No en RG90', value: `${rg90Summary?.no_en_rg90 ?? 0}`, color: '#b3402f' },
    { key: 'No en libro propio', label: 'No en libro propio', value: `${rg90Summary?.no_en_libro ?? 0}`, color: '#b3402f' },
    { key: 'Salto de numeración', label: 'Saltos', value: `${rg90Summary?.saltos ?? 0}`, color: '#b0740f' },
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
    try {
      // Un solo pedido para todos los archivos — ya no hace falta agruparlos por sistema
      // de antemano: el backend detecta, por archivo, cuál de los perfiles conocidos
      // corresponde (ver /api/ingest y archivos_detectados en la respuesta).
      const resultado = await ingestFilesApi(archivosReales, 'auto');
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
        setConvertError('El servidor procesó el/los archivo(s) pero no encontró ningún comprobante válido. Revisá que sea el reporte correcto (hoja "tal como se descarga del sistema", sin editar a mano).');
      }
      setConverted(true);
      setCargaUploaderOpen(false);
      setPage(1);
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : 'Error al procesar los archivos en el servidor.');
      // No avanzamos a "convertido": mejor mostrar el error y dejar reintentar que
      // mostrar datos de ejemplo como si fueran el resultado real.
    } finally {
      setConverting(false);
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
    }
  };

  const analyzeRg90 = async () => {
    if (!rg90Attached || rg90Files.length === 0) return;

    setRg90Analyzing(true);
    setRg90Error(null);
    try {
      const res = await reconcileApi(rg90Files, libroRows, loteId);
      setRg90DiffRows(res.diffs || []);
      setRg90Rows(res.rg90_rows || []);
      setRg90GridPage(1);
      setRg90Summary({
        coinciden: res.summary?.coinciden ?? 0,
        no_en_rg90: res.summary?.no_en_rg90 ?? 0,
        no_en_libro: res.summary?.no_en_libro ?? 0,
        saltos: res.summary?.saltos ?? 0,
      });
      setRg90Loaded(true);
      // Se queda en el Paso 3, listando los registros de la RG90 — el usuario avanza al
      // Paso 4 con "Siguiente" cuando quiera ver el resultado, igual que Compras.
    } catch (e) {
      setRg90Error(e instanceof Error ? e.message : 'Error al ejecutar la comparación RG90.');
    } finally {
      setRg90Analyzing(false);
    }
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
        setRg90GridColFiltros({});
        setRg90PasoMostrado(3);
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
        setRg90GridColFiltros({});
        setRg90PasoMostrado(3);
        setCargaUploaderOpen(true);
      },
    });
  };

  // Formato de columnas y resumen tomados 1:1 de la hoja "LIBRO VENTAS GLOBAL-Fact-NC" del
  // archivo de referencia del cliente (Libro Ventas Mes de Mayo 2026 ACDG v2.xlsx): fila
  // TOTAL pegada al final de los datos, y m\u00E1s abajo un bloque RESUMEN con el total de
  // Factura, el de Nota de Cr\u00E9dito, el NETO (suma de ambos) y un Check de redondeo.
  const downloadLimpio = () => {
    const headers = ['Proyecto', 'Factura', 'Tipo Doc.', 'Fecha', 'Ruc', 'Nombre', 'Gravadas 10%', 'IVA 10%', 'Gravadas 5%', 'IVA 5%', 'Exentas', 'Total Neto', 'Estado'];
    const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
    const dataRows = libroRows.map(r => [
      r.local, r.doc, r.tipo_doc ?? 'Factura', r.fecha, r.ruc, r.nombre,
      r.gravadas_num ?? 0, r.iva_num ?? 0, r.gravadas_5_num ?? 0, r.iva_5_num ?? 0, r.exentas_num ?? 0, r.total_num ?? 0, r.estado,
    ].map(esc).join(';'));

    const sumFields = (pred: (r: LibroRow) => boolean) => {
      const subset = libroRows.filter(pred);
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

    const totalRow = ['', '', '', '', '', 'TOTAL', totalGeneral.gravada10, totalGeneral.iva10, totalGeneral.gravada5, totalGeneral.iva5, totalGeneral.exentas, totalGeneral.total, ''].map(esc).join(';');
    const blank = ['', '', '', '', '', '', '', '', '', '', '', '', ''].map(esc).join(';');
    const resumenHeader = ['', '', '', '', '', 'RESUMEN', '', '', '', '', '', '', ''].map(esc).join(';');
    const facturaRow = ['', '', '', '', '', 'Factura', totalFactura.gravada10, totalFactura.iva10, totalFactura.gravada5, totalFactura.iva5, totalFactura.exentas, totalFactura.total, ''].map(esc).join(';');
    const ncRow = ['', '', '', '', '', 'Nota de Cr\u00E9dito', totalNC.gravada10, totalNC.iva10, totalNC.gravada5, totalNC.iva5, totalNC.exentas, totalNC.total, ''].map(esc).join(';');
    const netoRow = ['', '', '', '', '', 'NETO', neto.gravada10, neto.iva10, neto.gravada5, neto.iva5, neto.exentas, neto.total, ''].map(esc).join(';');
    const checkRow = ['', '', '', '', '', 'Check', '', '', '', '', '', check, ''].map(esc).join(';');

    const csv = '\uFEFF' + [
      headers.map(esc).join(';'), ...dataRows, totalRow,
      blank, blank, blank,
      resumenHeader, blank, facturaRow, ncRow, netoRow, checkRow,
    ].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Libro_Ventas_Global_formato_limpio.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Guidance texts and wizard steps
  let nextCtaLabel = 'Ir a cargar reportes';
  let nextCtaAction = () => setScreen('carga');
  let guidanceText = 'Todavía no cargaste ningún reporte.';

  if (hasAnyUpload && !converted) {
    nextCtaLabel = 'Analizar y convertir';
    nextCtaAction = () => setScreen('carga');
    guidanceText = 'Ya cargaste reportes. Analizalos y convertilos para generar el libro de ventas.';
  } else if (converted && !rg90Loaded) {
    nextCtaLabel = 'Cargar y comparar RG90';
    nextCtaAction = () => { setScreen('rg90'); setRg90PasoMostrado(3); };
    guidanceText = 'El libro de ventas ya está listo. Cargá el archivo RG90 para comparar.';
  } else if (converted && rg90Loaded) {
    nextCtaLabel = 'Ver comparación';
    nextCtaAction = () => { setScreen('rg90'); setRg90PasoMostrado(4); };
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
    const current = !converted ? 1 : screen !== 'rg90' ? 2 : !rg90Loaded ? 3 : 4;
    const active = st.n === current;
    const done = st.n < current;
    const reachable = st.n <= current;
    return {
      ...st,
      circleStyle: (done ? 'background:#128752;color:#fff' : active ? 'background:#f0a63d;color:#1a1a1a' : 'background:#e5e2da;color:#9aa1ab') + (reachable && !active ? ';cursor:pointer' : ';cursor:default'),
      labelStyle: (active ? 'color:#22262b;font-weight:700' : done ? 'color:#128752;font-weight:600' : 'color:#9aa1ab') + (reachable && !active ? ';cursor:pointer' : ''),
      mark: done ? '✓' : String(st.n),
      goTo: !reachable || active ? undefined : () => {
        if (st.n === 1) setScreen('carga');
        else if (st.n === 2) setScreen('carga');
        else if (st.n === 3) { setScreen('rg90'); setRg90PasoMostrado(3); }
        else { setScreen('rg90'); setRg90PasoMostrado(4); }
      },
    };
  });

  // Table filtering and pagination
  let filteredLibro = libroRows.filter(r => matchesSistema(r.sistema, filtro));
  if (estadoFilter) filteredLibro = filteredLibro.filter(r => r.estado === estadoFilter);
  for (const col of LIBRO_COLUMNAS) {
    const activo = libroColFiltros[col.key];
    if (activo) filteredLibro = filteredLibro.filter(r => activo.has(col.getValue(r)));
  }
  if (searchGeneral.trim()) {
    const q = searchGeneral.trim().toLowerCase();
    filteredLibro = filteredLibro.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }

  const libroColumnFilters = LIBRO_COLUMNAS.map(col => ({
    key: col.key,
    label: col.label,
    allValues: libroRows.map(col.getValue),
    active: libroColFiltros[col.key] ?? null,
    onChange: (next: Set<string> | null) => { setLibroColFiltros(prev => ({ ...prev, [col.key]: next })); setPage(1); },
  }));
  const hayLibroColFiltrosActivos = Object.values(libroColFiltros).some(v => v !== null && v !== undefined);
  const limpiarLibroColFiltros = () => { setLibroColFiltros({}); setPage(1); };

  // Totalizador sobre TODO lo filtrado (tabs de sistema + filtros de columna + buscador),
  // no solo la página visible — para que el total acompañe al filtro, no a la paginación.
  const libroTotales = {
    gravadas: filteredLibro.reduce((s, r) => s + (r.gravadas_num || 0), 0),
    iva: filteredLibro.reduce((s, r) => s + (r.iva_num || 0), 0),
    gravadas_5: filteredLibro.reduce((s, r) => s + (r.gravadas_5_num || 0), 0),
    iva_5: filteredLibro.reduce((s, r) => s + (r.iva_5_num || 0), 0),
    exentas: filteredLibro.reduce((s, r) => s + (r.exentas_num || 0), 0),
    total: filteredLibro.reduce((s, r) => s + (r.total_num || 0), 0),
  };

  const totalPages = Math.max(1, Math.ceil(filteredLibro.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pagedLibro = filteredLibro.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(r => ({
    ...r,
    estadoStyle: r.estado === 'Anulada' ? 'background:#fbe9e3;color:#b3402f;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px' : 'background:#e8f3ec;color:#128752;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px',
  }));

  // Grilla del Paso 3 (Adjuntar RG90) — mismos filtros/columnas/totalizador que la del
  // Paso 2, reutilizando LIBRO_COLUMNAS porque rg90Rows tiene la misma forma (LibroRow[]).
  let filteredRg90Rows = rg90Rows;
  for (const col of LIBRO_COLUMNAS) {
    const activo = rg90GridColFiltros[col.key];
    if (activo) filteredRg90Rows = filteredRg90Rows.filter(r => activo.has(col.getValue(r)));
  }
  if (rg90GridSearch.trim()) {
    const q = rg90GridSearch.trim().toLowerCase();
    filteredRg90Rows = filteredRg90Rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }
  const rg90GridColumnFilters = LIBRO_COLUMNAS.map(col => ({
    key: col.key,
    label: col.label,
    allValues: rg90Rows.map(col.getValue),
    active: rg90GridColFiltros[col.key] ?? null,
    onChange: (next: Set<string> | null) => { setRg90GridColFiltros(prev => ({ ...prev, [col.key]: next })); setRg90GridPage(1); },
  }));
  const hayRg90GridColFiltrosActivos = Object.values(rg90GridColFiltros).some(v => v !== null && v !== undefined);
  const limpiarRg90GridColFiltros = () => { setRg90GridColFiltros({}); setRg90GridPage(1); };
  const rg90GridTotales = {
    gravadas: filteredRg90Rows.reduce((s, r) => s + (r.gravadas_num || 0), 0),
    iva: filteredRg90Rows.reduce((s, r) => s + (r.iva_num || 0), 0),
    gravadas_5: filteredRg90Rows.reduce((s, r) => s + (r.gravadas_5_num || 0), 0),
    iva_5: filteredRg90Rows.reduce((s, r) => s + (r.iva_5_num || 0), 0),
    exentas: filteredRg90Rows.reduce((s, r) => s + (r.exentas_num || 0), 0),
    total: filteredRg90Rows.reduce((s, r) => s + (r.total_num || 0), 0),
  };
  const rg90GridTotalPages = Math.max(1, Math.ceil(filteredRg90Rows.length / pageSize));
  const rg90GridCurrentPage = Math.min(Math.max(1, rg90GridPage), rg90GridTotalPages);
  const pagedRg90Rows = filteredRg90Rows.slice((rg90GridCurrentPage - 1) * pageSize, rg90GridCurrentPage * pageSize);

  const filteredCorrel = correlatividadRows.filter(r => matchesSistema(r.sistema, correlFiltro));

  // Estado de ingesta por sistema origen: calculado de los datos reales del libro
  // cargado, no valores fijos — refleja exactamente lo que se subió y proceso.
  const importStatusComputed = SYSTEMS_META.map(sysMeta => {
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
    };
  });

  const filteredRg90Diff = rg90DiffRows
    .filter(r => !rg90Search || Object.values(r).some(v => String(v).toLowerCase().includes(rg90Search.toLowerCase())))
    .filter(r => !rg90CategoryFilter || r.diferencia === rg90CategoryFilter)
    .map(r => {
      let diffStyle = 'background:#f0eee8;color:#5c6470;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px';
      if (r.diferencia === 'No llegó a la interfaz' || r.diferencia === 'No en libro propio') {
        diffStyle = 'background:#fbe9e3;color:#b3402f;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px';
      } else if (r.diferencia === 'Rechazada' || r.diferencia === 'Salto de numeración') {
        diffStyle = 'background:#fdf1de;color:#b0740f;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px';
      } else if (r.diferencia === 'Anulada') {
        diffStyle = 'background:#f1eef8;color:#5b3aa8;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px';
      }
      return { ...r, diffChipStyle: diffStyle };
    });

  // Cobertura por local: calculada de los datos reales del libro, la correlatividad y el
  // resultado de la comparación RG90 — no un listado fijo de locales de muestra.
  const rg90ByLocalComputed = Array.from(new Set(libroRows.map(r => r.local))).map(local => ({
    local,
    sistema: libroRows.find(r => r.local === local)?.sistema || '',
    comprobantes: libroRows.filter(r => r.local === local).length,
    diferencias: rg90DiffRows.filter(d => d.local === local && d.diferencia !== 'Anulada').length,
    saltos: correlatividadRows.filter(r => r.local === local).length,
  }));

  const [title, subtitle] = TITLES[screen];

  if (!authed) {
    return <LoginView onLoginSuccess={() => setAuthed(true)} />;
  }

  const handleLogout = () => {
    setAuthToken(null);
    setAuthed(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#faf9f5' }}>
      <Sidebar currentScreen={screen} onNavigate={(sc) => setScreen(sc)} permisos={permisos} />

      <main style={{ marginLeft: '260px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title={title} subtitle={subtitle} onLogout={handleLogout} />

        <div style={{ padding: '32px', flex: 1 }}>
          {screen === 'dashboard' && (
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
              onNavigate={(sc) => setScreen(sc)}
            />
          )}

          {screen === 'carga' && (
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
                removeBtnStyle: 'background:#fff;border:1px solid #e2e0da;color:#b3402f;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer',
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
              goToRg90={() => setScreen('rg90')}
              saltosRows={correlatividadRows}
              deleteLibro={deleteLibro}
              downloadLimpio={downloadLimpio}
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
              onVerTodos={() => setScreen('libroCompleto')}
              step2Cards={[
                { label: 'Locales', value: `${new Set(libroRows.map(r => r.local)).size}` },
                { label: 'Comprobantes', value: `${libroRows.length}` },
                { label: 'Saltos', value: `${correlatividadRows.length}` },
              ]}
            />
          )}

          {screen === 'libroCompleto' && (
            <LibroCompletoView
              rows={
                filteredLibro.filter(r =>
                  !libroCompletoSearch.trim() ||
                  Object.values(r).some(v => String(v).toLowerCase().includes(libroCompletoSearch.trim().toLowerCase()))
                )
              }
              totalSinFiltrar={libroRows.length}
              search={libroCompletoSearch}
              onSearch={(e) => setLibroCompletoSearch(e.target.value)}
              onVolver={() => { setLibroCompletoSearch(''); setScreen('carga'); }}
              onDownload={downloadLimpio}
            />
          )}

          {screen === 'correl' && (
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
          )}

          {screen === 'compras' && (
            <ComprasView locales={locales} permisos={permisos} />
          )}

          {screen === 'locales' && (
            <LocalesView
              locales={locales}
              loading={localesLoading}
              error={localesError}
              refetch={refetchLocales}
              canCrear={puede('boton:locales.crear')}
              canEditar={puede('boton:locales.editar')}
              canEliminar={puede('boton:locales.eliminar')}
            />
          )}

          {screen === 'usuarios' && (
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
          )}

          {screen === 'roles' && (
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
          )}

          {screen === 'rg90' && (
            <RG90View
              wizardSteps={wizardSteps}
              pasoMostrado={rg90PasoMostrado}
              onVolverCarga={() => setScreen('carga')}
              onSiguienteResultado={() => rg90Loaded && setRg90PasoMostrado(4)}
              onVolverPaso3={() => setRg90PasoMostrado(3)}
              rg90Loaded={rg90Loaded}
              rg90Attached={rg90Attached}
              rg90StatusText={
                rg90Analyzing
                  ? 'Comparando contra la RG90 en el servidor…'
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
                rg90Attached && !rg90Analyzing
                  ? 'background:#f0a63d;color:#1a1a1a;border:none;border-radius:7px;padding:10px 16px;font-size:12.5px;font-weight:700;cursor:pointer'
                  : 'background:#e5e2da;color:#9aa1ab;border:none;border-radius:7px;padding:10px 16px;font-size:12.5px;font-weight:700;cursor:not-allowed'
              }
              rg90Analyzing={rg90Analyzing}
              rg90Error={rg90Error}
              canComparar={puede('boton:rg90.comparar')}
              canQuitarArchivo={puede('boton:rg90.quitar_archivo')}
              simulateRg90={simulateRg90Upload}
              onRg90FileUpload={handleRg90FileUpload}
              analyzeRg90={analyzeRg90}
              resetRg90={resetRg90}
              rg90Cards={rg90CardsState.map(c => ({
                ...c,
                isActive: rg90CategoryFilter === c.key && c.key !== '',
                onClick: c.key === '' ? () => setRg90CategoryFilter('') : () => setRg90CategoryFilter(prev => (prev === c.key ? '' : c.key)),
              }))}
              rg90Diff={filteredRg90Diff}
              rg90ByLocal={rg90ByLocalComputed}
              rg90Search={rg90Search}
              onRg90Search={(e) => setRg90Search(e.target.value)}
              clearRg90Search={() => setRg90Search('')}
              rg90CategoryFilter={rg90CategoryFilter}
              clearRg90Category={() => setRg90CategoryFilter('')}
              rg90GridRows={pagedRg90Rows}
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
          )}
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
