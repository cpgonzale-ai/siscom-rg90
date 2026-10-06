// Ambiente en el que corre esta copia de la app. Se decide por el host desde el que se
// carga la página (no por una variable de build), así el mismo bundle siempre muestra el
// ambiente correcto:
//   - siscom.top          -> PRODUCCIÓN
//   - siscom.corvis.top   -> DESARROLLO
//   - cualquier otro host (localhost, previews, etc.) -> PRUEBA
const HOST_PRODUCCION = 'siscom.top';
const HOST_DESARROLLO = 'siscom.corvis.top';

const host = typeof window !== 'undefined' ? window.location.hostname : '';

export const esProduccion = host === HOST_PRODUCCION;
export const esDesarrollo = host === HOST_DESARROLLO;

export const etiquetaAmbiente = esProduccion
  ? 'PRODUCCIÓN'
  : esDesarrollo
    ? 'AMBIENTE DE DESARROLLO'
    : 'AMBIENTE DE PRUEBA';
