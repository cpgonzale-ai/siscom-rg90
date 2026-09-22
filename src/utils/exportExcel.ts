import * as XLSX from 'xlsx';

// Genera un .xlsx real (no CSV) a partir de filas ya armadas como texto. Los importes deben
// llegar como string ya formateado ("18.891.429,00"), nunca como number — si se escriben
// como number, Excel los vuelve a formatear según la configuración regional de quien lo
// abre, lo que puede invertir coma y punto respecto a lo que se ve en la grilla (justo lo
// que no debe pasar: el archivo descargado tiene que coincidir con la pantalla, punto por
// punto y coma por coma).
//
// Solo para grillas chicas (no hay techo de filas conocido, pero esto arma TODO el .xlsx en
// memoria del navegador) — para grillas que pueden llegar a 200.000 filas (Detalle de
// Discrepancias, RG90 (SET) — Ventas) el archivo se genera en el backend en cambio, ver
// exportarDiffVentasExcelApi/exportarTablaExcelApi en services/api.ts y
// auditoria/13-export-excel-wysiwyg.md — la librería xlsx (SheetJS) revienta con
// "JavaScript heap out of memory" a ese volumen, sin importar si corre en el hilo principal
// o en un Web Worker (se probaron ambos).
export function downloadExcel(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
