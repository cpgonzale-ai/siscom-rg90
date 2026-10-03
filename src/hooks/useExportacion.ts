import { useState } from 'react';

// Ejecuta una descarga a Excel, mostrando el estado "generando" mientras dura y evitando
// disparar dos veces la misma descarga. Un fallo se registra en consola sin romper la vista
// (mismo criterio que los handlers que reemplaza). Se usa una instancia por cada botón de
// descarga, para que cada uno tenga su propio estado.
export function useExportacion() {
  const [exportando, setExportando] = useState(false);

  const exportar = async (descarga: () => Promise<void>, mensajeError: string) => {
    if (exportando) return;
    setExportando(true);
    try {
      await descarga();
    } catch (e) {
      console.error(mensajeError, e);
    } finally {
      setExportando(false);
    }
  };

  return { exportando, exportar };
}
