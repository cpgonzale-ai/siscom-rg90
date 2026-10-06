// Ambiente en el que corre esta copia de la app. Se decide por el host desde el que se
// carga la página (no por una variable de build), así el mismo bundle siempre muestra el
// ambiente correcto, sin depender de cómo se haya compilado. Cualquier host que no sea el
// de producción (localhost, previews, etc.) se trata como prueba.
const HOST_PRODUCCION = 'siscom.corvis.top';

export const esProduccion =
  typeof window !== 'undefined' && window.location.hostname === HOST_PRODUCCION;

export const etiquetaAmbiente = esProduccion ? 'PRODUCCIÓN' : 'AMBIENTE DE PRUEBA';
