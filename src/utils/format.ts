// Mismo formato que usa el backend para los importes ("18.891.429,00": punto de miles,
// coma decimal) — para totalizadores/exportes que se calculan del lado del frontend. Los
// importes que YA vienen formateados del backend (r.gravadas, r.total, etc.) nunca deben
// pasar por acá ni por ninguna otra conversión: se muestran/exportan tal cual llegan, para
// no arriesgar que se invierta coma y punto.
//
// Se reutiliza UNA sola instancia de Intl.NumberFormat: llamar n.toLocaleString(...) en cada
// celda crea un formateador nuevo por llamada, y con miles de diferencias (cada una con
// varios importes) eso bloqueaba el navegador varios segundos al entrar al resultado.
const FORMATO_GS = new Intl.NumberFormat('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatGs = (n: number): string => FORMATO_GS.format(n);
