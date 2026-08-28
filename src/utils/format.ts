// Mismo formato que usa el backend para los importes ("18.891.429,00": punto de miles,
// coma decimal) — para totalizadores/exportes que se calculan del lado del frontend. Los
// importes que YA vienen formateados del backend (r.gravadas, r.total, etc.) nunca deben
// pasar por acá ni por ninguna otra conversión: se muestran/exportan tal cual llegan, para
// no arriesgar que se invierta coma y punto.
export const formatGs = (n: number): string =>
  n.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
