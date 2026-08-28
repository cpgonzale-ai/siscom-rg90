import * as XLSX from 'xlsx';

// Genera un .xlsx real (no CSV) a partir de filas ya armadas como texto. Los importes deben
// llegar como string ya formateado ("18.891.429,00"), nunca como number — si se escriben
// como number, Excel los vuelve a formatear según la configuración regional de quien lo
// abre, lo que puede invertir coma y punto respecto a lo que se ve en la grilla (justo lo
// que no debe pasar: el archivo descargado tiene que coincidir con la pantalla, punto por
// punto y coma por coma).
export function downloadExcel(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
