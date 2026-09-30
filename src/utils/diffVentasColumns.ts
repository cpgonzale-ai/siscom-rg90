import { formatGs } from './format';
import type { RG90DiffRow, RG90DiffLado } from '../services/api';

// Extraído de RG90View.tsx para que lo pueda usar tanto la vista (grilla en pantalla) como
// diffExportWorker.ts (Web Worker del export a Excel) sin duplicar la lógica de negocio —
// ver auditoria/13-export-excel-wysiwyg.md: el export anterior calculaba estas 21 columnas x
// 200.000 filas en el hilo principal ANTES de mandarle los datos al worker, así que mover
// solo el armado del .xlsx al worker no alcanzaba — el cálculo pesado (esto de acá) tiene
// que correr DENTRO del worker también.

// Suma de importes formateados como los devuelve el backend ("18.891.429,00") — se
// necesita volver a número para poder sumar/restar entre filas antes de re-formatear.
export const parseGs = (s: string): number => {
  const n = parseFloat(String(s ?? '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

// Mismo criterio que en Compras: si la fila es "Diferencia de monto", el campo que no está
// en diferencias_detalle (no difiere) se muestra en 0 — solo quedan visibles los importes
// que realmente causan la diferencia.
export const valorCeldaDiffVentas = (d: RG90DiffRow, lado: 'libro' | 'rg90', campo: keyof RG90DiffLado): string => {
  const valor = d[lado][campo];
  if (d.diferencia !== 'Diferencia de monto' || valor === '—') return valor;
  return d.diferencias_detalle && campo in d.diferencias_detalle ? valor : '0,00';
};

// Bug real corregido acá: antes esto recalculaba la diferencia restando los strings ya
// formateados de libro/rg90 (parseGs(libro) - parseGs(rg90)) -- para una Nota de Crédito, el
// libro guarda el monto en NEGATIVO (ver _process_dataframe_vectorizado, engine.py) mientras
// que la RG90 siempre lo informa en positivo. El backend SÍ compara por magnitud (usa
// abs(pos_rec[...]) antes de restar, ver _comparar_par) para decidir si hay diferencia Y para
// calcular su valor real (guardado en diferencias_detalle) -- pero esta función volvía a
// restar los valores CRUDOS (con signo), dando un número muy distinto al real para NC: un
// caso real de diferencia=500 se mostraba como -200.500 (signo falso, ~400x el valor real).
// Ahora se usa DIRECTAMENTE el valor que el backend ya calculó correctamente (mismo criterio
// que valorCeldaDiffVentas ya usa para decidir si un campo es 0 o no), en vez de recalcularlo
// acá con una fórmula que no contempla el signo de las NC.
export const diferenciaCampoVentas = (d: RG90DiffRow, campo: keyof RG90DiffLado): string => {
  if (d.diferencia === 'Diferencia de monto' && d.diferencias_detalle && campo in d.diferencias_detalle) {
    return formatGs(d.diferencias_detalle[campo]);
  }
  return formatGs(parseGs(valorCeldaDiffVentas(d, 'libro', campo)) - parseGs(valorCeldaDiffVentas(d, 'rg90', campo)));
};

export const RG90_DIFF_COLUMNAS: { key: string; label: string; getValue: (d: RG90DiffRow) => string }[] = [
  { key: 'doc', label: 'Documento', getValue: d => d.doc },
  { key: 'tipo_doc', label: 'Tipo', getValue: d => d.tipo_doc },
  { key: 'sistema', label: 'Sistema', getValue: d => d.sistema },
  { key: 'local', label: 'Local', getValue: d => d.local },
  { key: 'libro_gravada_10', label: 'Gravada 10%', getValue: d => valorCeldaDiffVentas(d, 'libro', 'gravada_10') },
  { key: 'libro_gravada_5', label: 'Gravada 5%', getValue: d => valorCeldaDiffVentas(d, 'libro', 'gravada_5') },
  { key: 'libro_iva_10', label: 'IVA 10%', getValue: d => valorCeldaDiffVentas(d, 'libro', 'iva_10') },
  { key: 'libro_iva_5', label: 'IVA 5%', getValue: d => valorCeldaDiffVentas(d, 'libro', 'iva_5') },
  { key: 'libro_exenta', label: 'Exenta', getValue: d => valorCeldaDiffVentas(d, 'libro', 'exenta') },
  { key: 'libro_total', label: 'Total', getValue: d => valorCeldaDiffVentas(d, 'libro', 'total') },
  { key: 'rg_gravada_10', label: 'Gravada 10%', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'gravada_10') },
  { key: 'rg_gravada_5', label: 'Gravada 5%', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'gravada_5') },
  { key: 'rg_iva_10', label: 'IVA 10%', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'iva_10') },
  { key: 'rg_iva_5', label: 'IVA 5%', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'iva_5') },
  { key: 'rg_exenta', label: 'Exenta', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'exenta') },
  { key: 'rg_total', label: 'Total', getValue: d => valorCeldaDiffVentas(d, 'rg90', 'total') },
  { key: 'dif_gravada_10', label: 'Gravada 10%', getValue: d => diferenciaCampoVentas(d, 'gravada_10') },
  { key: 'dif_gravada_5', label: 'Gravada 5%', getValue: d => diferenciaCampoVentas(d, 'gravada_5') },
  { key: 'dif_iva_10', label: 'IVA 10%', getValue: d => diferenciaCampoVentas(d, 'iva_10') },
  { key: 'dif_iva_5', label: 'IVA 5%', getValue: d => diferenciaCampoVentas(d, 'iva_5') },
  { key: 'dif_exenta', label: 'Exenta', getValue: d => diferenciaCampoVentas(d, 'exenta') },
  { key: 'dif_total', label: 'Total', getValue: d => diferenciaCampoVentas(d, 'total') },
  { key: 'diferencia', label: 'Diferencia / Diagnóstico', getValue: d => d.diferencia },
];

export const RG90_DIFF_COLUMNAS_PICKER: { key: string; label: string }[] = [
  { key: 'doc', label: 'Documento' },
  { key: 'tipo_doc', label: 'Tipo' },
  { key: 'sistema', label: 'Sistema' },
  { key: 'local', label: 'Local' },
  { key: 'libro_gravada_10', label: 'Libro — Gravada 10%' },
  { key: 'libro_gravada_5', label: 'Libro — Gravada 5%' },
  { key: 'libro_iva_10', label: 'Libro — IVA 10%' },
  { key: 'libro_iva_5', label: 'Libro — IVA 5%' },
  { key: 'libro_exenta', label: 'Libro — Exenta' },
  { key: 'libro_total', label: 'Libro — Total' },
  { key: 'rg_gravada_10', label: 'RG90 — Gravada 10%' },
  { key: 'rg_gravada_5', label: 'RG90 — Gravada 5%' },
  { key: 'rg_iva_10', label: 'RG90 — IVA 10%' },
  { key: 'rg_iva_5', label: 'RG90 — IVA 5%' },
  { key: 'rg_exenta', label: 'RG90 — Exenta' },
  { key: 'rg_total', label: 'RG90 — Total' },
  { key: 'dif_gravada_10', label: 'Diferencia — Gravada 10%' },
  { key: 'dif_gravada_5', label: 'Diferencia — Gravada 5%' },
  { key: 'dif_iva_10', label: 'Diferencia — IVA 10%' },
  { key: 'dif_iva_5', label: 'Diferencia — IVA 5%' },
  { key: 'dif_exenta', label: 'Diferencia — Exenta' },
  { key: 'dif_total', label: 'Diferencia — Total' },
  { key: 'diferencia', label: 'Diferencia / Diagnóstico' },
];

export const CAMPOS_DIFF_VENTAS: (keyof RG90DiffLado)[] = ['gravada_10', 'gravada_5', 'iva_10', 'iva_5', 'exenta', 'total'];
