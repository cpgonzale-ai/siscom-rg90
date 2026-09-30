import * as XLSX from 'xlsx';

// Cuenta aproximada de filas de datos de uno o más .xlsx, hecha en el navegador (SheetJS,
// ya usado en el proyecto para exportar — ver utils/exportExcel.ts) -- SOLO para mostrar un
// total orientativo en el indicador de progreso (ver ProgressModal). Nunca se usa para
// ninguna regla de negocio ni para ningún valor de los resultados, que siguen viniendo
// exclusivamente del backend (única fuente de verdad). Toma, de cada archivo, la hoja con
// más filas (la hoja de datos real, no una portada) y resta 1 fila de encabezado
// (aproximado, no crítico para un indicador visual).
export async function contarFilasAproximado(files: File[]): Promise<number> {
  let total = 0;
  for (const file of files) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', sheetStubs: false, cellFormula: false, cellHTML: false, cellText: false });
      let max = 0;
      for (const nombre of wb.SheetNames) {
        const ref = wb.Sheets[nombre]?.['!ref'];
        if (!ref) continue;
        const range = XLSX.utils.decode_range(ref);
        const filas = range.e.r - range.s.r + 1;
        if (filas > max) max = filas;
      }
      total += Math.max(0, max - 1);
    } catch {
      // Si no se puede leer (formato no soportado, archivo corrupto), no rompe el flujo de
      // conversión/validación real -- el backend es quien de verdad valida el archivo, esto
      // es solo para el indicador visual de avance.
    }
  }
  return total;
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
export async function ejecutarConAvance<T>(
  tarea: (onUploadProgress: (loaded: number, total: number) => void) => Promise<T>,
  onFraccion: (fraccion: number) => void,
): Promise<T> {
  let subidaCompleta = false;
  const detenerSimulado = crearAvanceSimulado((f) => {
    if (subidaCompleta) onFraccion(0.9 + f * 0.1);
  });
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
  }
}
