import { describe, it, expect } from 'vitest';
import { valorCeldaDiffVentas, diferenciaCampoVentas } from './diffVentasColumns';
import type { RG90DiffRow, RG90DiffLado } from '../services/api';

const lado = (over: Partial<RG90DiffLado> = {}): RG90DiffLado => ({
  gravada_10: '1.000,00', iva_10: '100,00', gravada_5: '0,00', iva_5: '0,00', exenta: '0,00', total: '1.100,00', ...over,
});

const fila = (over: Partial<RG90DiffRow>): RG90DiffRow => ({
  doc: 'D1', tipo_doc: 'Factura', sistema: 'Aloha', local: 'L1',
  libro: lado(), rg90: lado(), diferencia: 'Coincide', ...over,
});

describe('valorCeldaDiffVentas', () => {
  it('en Coincide muestra el valor tal cual', () => {
    expect(valorCeldaDiffVentas(fila({}), 'libro', 'iva_10')).toBe('100,00');
  });

  it('en Diferencia de importe muestra en 0 los campos que no causaron la diferencia', () => {
    const d = fila({ diferencia: 'Diferencia de importe', diferencias_detalle: { total: 200 } });
    expect(valorCeldaDiffVentas(d, 'libro', 'total')).toBe('1.100,00');
    expect(valorCeldaDiffVentas(d, 'libro', 'iva_10')).toBe('0,00');
  });

  it('un guion (comprobante ausente de ese lado) se respeta tal cual', () => {
    const d = fila({ rg90: lado({ total: '—' }) });
    expect(valorCeldaDiffVentas(d, 'rg90', 'total')).toBe('—');
  });
});

describe('diferenciaCampoVentas', () => {
  it('usa el valor ya calculado por el backend cuando hay diferencia', () => {
    const d = fila({ diferencia: 'Diferencia de importe', diferencias_detalle: { total: 500 } });
    expect(diferenciaCampoVentas(d, 'total')).toBe('500,00');
  });

  it('en Coincide calcula libro menos RG', () => {
    expect(diferenciaCampoVentas(fila({}), 'total')).toBe('0,00');
  });
});
