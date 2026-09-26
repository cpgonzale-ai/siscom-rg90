import * as XLSX from 'xlsx';

// Genera un .xlsx real (no CSV) a partir de filas ya armadas como texto. Los importes
// llegan como string ya formateado ("18.891.429,00" — mismo texto que se ve en la grilla).
//
// Decisión revisada (antes se escribían tal cual como texto, a propósito, para que el
// Excel coincidiera con la pantalla sin importar la configuración regional de quien lo
// abre — ver auditoria/13-export-excel-wysiwyg.md). Se cambió a pedido explícito: los
// usuarios necesitan poder sumar columnas de montos en Excel, algo imposible con celdas de
// texto. Ahora, todo string que matchea el patrón numérico latino (miles con ".", decimales
// con ",") se escribe como number real + formato de celda "#,##0.00" — en un Excel
// configurado en es-PY (el caso real de este cliente) se sigue viendo idéntico a la
// pantalla, y además ahora sí se puede sumar/multiplicar. Ver `parseMontoLatino` para el
// detalle de qué strings se consideran "numéricos" (nunca documentos, RUCs ni fechas).
//
// Solo para grillas chicas (no hay techo de filas conocido, pero esto arma TODO el .xlsx en
// memoria del navegador) — para grillas que pueden llegar a 200.000 filas (Detalle de
// Discrepancias, RG90 (SET) — Ventas) el archivo se genera en el backend en cambio, ver
// exportarDiffVentasExcelApi/exportarTablaExcelApi en services/api.ts y
// app/api/export.py (mismo criterio de conversión, aplicado ahí en Python).

const MONTO_LATINO_RE = /^-?\d{1,3}(\.\d{3})*(,\d+)?$/;

/** "18.891.429,00" -> 18891429; "-110.000,00" -> -110000; "0,00" -> 0. Cualquier otra cosa
    (documento, RUC, fecha, "—", texto libre) devuelve null y se deja como string. */
export function parseMontoLatino(s: string): number | null {
  const t = s.trim();
  if (!MONTO_LATINO_RE.test(t)) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function downloadExcel(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  const data: (string | number)[][] = [
    headers,
    ...rows.map(row => row.map(cell => (typeof cell === 'string' ? parseMontoLatino(cell) ?? cell : cell))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Formato de celda para que, en un Excel configurado en es-PY, los number recién
  // convertidos se vean con el mismo separador de miles/decimales que la pantalla
  // ("#,##0.00" son placeholders — Excel los reemplaza por los caracteres reales de coma/
  // punto según la configuración regional de quien lo abre).
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n') {
        cell.z = '#,##0.00';
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
