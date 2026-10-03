// Claves y colores de las categorías de diferencia del Paso de Resultados. Compartidos por
// Ventas (App.tsx, rg90CardsState) y Compras (ComprasView.tsx, RESUMEN_CATEGORIAS) para que
// no puedan divergir. Las etiquetas visibles NO se comparten: cada módulo las redacta según
// su libro (p. ej. "libro de ventas" vs "libro de compras").
export const CATEGORIA = {
  COINCIDE: 'Coincide',
  NO_LLEGO: 'No llegó a la interfaz',
  NO_EXISTE_EN_LIBRO: 'No existe en el libro',
  DIF_IMPORTE: 'Diferencia de importe',
  DIF_TASAS: 'Diferencias en tasas',
} as const;

export const COLOR_CATEGORIA: Record<string, string> = {
  [CATEGORIA.COINCIDE]: '#128752',
  [CATEGORIA.NO_LLEGO]: '#b3402f',
  [CATEGORIA.NO_EXISTE_EN_LIBRO]: '#b3402f',
  [CATEGORIA.DIF_IMPORTE]: '#b0740f',
  [CATEGORIA.DIF_TASAS]: '#c9920c',
};
