// Antes contaba las filas de cada .xlsx parseándolo en el navegador (con la librería xlsx,
// que tiene CVEs públicos sin parche vía npm, y procesaba archivos no confiables recién
// elegidos por el usuario) solo para mostrar un total orientativo en el indicador de
// progreso. Ya no se parsea nada del lado del cliente: devuelve 0, que ProgressModal ya
// interpreta como "total desconocido" y no muestra la línea "Procesados X de Y". El total
// real de filas lo conoce recién el backend, que es la única fuente de verdad.
export async function contarFilasAproximado(_files: File[]): Promise<number> {
  return 0;
}

// Avance simulado y ACOTADO para el tramo en que se espera la respuesta del servidor,
// después de que termina de subirse el archivo -- ese tiempo de parseo/procesamiento del
// lado del backend no es observable desde el navegador sin cambiar los endpoints a un
// mecanismo de streaming de progreso (fuera de alcance de este cambio, ver el pedido:
// "cambio técnico mínimo"; el progreso de SUBIDA en cambio sí es 100% real, ver
// xhrPostFormData en services/api.ts). La fracción nunca llega al tope por sí sola ni
// retrocede -- el 100% real lo pone quien llama, recién cuando la respuesta efectivamente
// llega, para no mostrarle al usuario un progreso completo antes de que el proceso termine.
export function crearAvanceSimulado(onTick: (fraccion: number) => void, tope = 0.97, intervaloMs = 180): () => void {
  let fraccion = 0;
  const id = window.setInterval(() => {
    fraccion += (tope - fraccion) * 0.06;
    onTick(fraccion);
  }, intervaloMs);
  return () => window.clearInterval(id);
}

// Combina el progreso REAL de subida (bytes enviados, vía xhr.upload.onprogress) con el
// avance simulado de la espera posterior en una única fracción 0..~0.997 -- el 90% del paso
// se reserva para la subida real, el 10% restante para la espera de la respuesta. `tarea`
// recibe el callback de progreso de subida y debe pasarlo a la llamada de api.ts
// correspondiente (ingestFilesApi, validarDuplicadosLibroApi, validarDuplicadosRg90Api).
// Cancelación de la operación en curso (botón "Cancelar" del ProgressModal). Hay a lo sumo
// una operación de carga/análisis activa a la vez -- el overlay bloqueante lo garantiza --
// así que alcanza con un único controlador a nivel de módulo, no hace falta pasar la señal
// por parámetro a cada llamada de api.ts.
let controladorActual: AbortController | null = null;

export function cancelarOperacionEnCurso(): void {
  controladorActual?.abort();
}

export function senalOperacionEnCurso(): AbortSignal | undefined {
  return controladorActual?.signal;
}

export function esCancelacion(e: unknown): boolean {
  return (e as { name?: unknown } | null)?.name === 'AbortError';
}

export async function ejecutarConAvance<T>(
  tarea: (onUploadProgress: (loaded: number, total: number) => void) => Promise<T>,
  onFraccion: (fraccion: number) => void,
): Promise<T> {
  let subidaCompleta = false;
  const detenerSimulado = crearAvanceSimulado((f) => {
    if (subidaCompleta) onFraccion(0.9 + f * 0.1);
  });
  controladorActual = new AbortController();
  try {
    return await tarea((loaded, total) => {
      const fraccionSubida = total > 0 ? loaded / total : 1;
      if (fraccionSubida >= 1) {
        subidaCompleta = true;
        return;
      }
      onFraccion(fraccionSubida * 0.9);
    });
  } finally {
    detenerSimulado();
    controladorActual = null;
  }
}
