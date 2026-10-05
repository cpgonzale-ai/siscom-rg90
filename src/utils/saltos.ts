// Total de saltos de numeración: suma de los números FALTANTES (columna "Faltantes"), no la
// cantidad de tramos. Un tramo puede faltar 1 número o cientos.
export const totalFaltantes = (rows: { cantidad?: number | string }[]): number =>
  rows.reduce((s, r) => s + (Number(r.cantidad) || 0), 0);
