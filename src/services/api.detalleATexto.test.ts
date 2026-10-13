import { describe, it, expect } from 'vitest';
import { detalleATexto } from './api';

describe('detalleATexto', () => {
  it('devuelve el string tal cual', () => {
    expect(detalleATexto('Archivo inválido')).toBe('Archivo inválido');
  });

  it('une los errores de validación de FastAPI en un texto legible', () => {
    const detail = [
      { type: 'missing', loc: ['body', 'files'], msg: 'Field required', input: null },
      { type: 'missing', loc: ['body', 'local_name'], msg: 'Field required' },
    ];
    expect(detalleATexto(detail)).toBe('files: Field required | local_name: Field required');
  });

  it('usa título y mensaje cuando el detail es un objeto (duplicados)', () => {
    const detail = { tipo: 'comprobantes_duplicados', titulo: 'Se detectaron comprobantes duplicados', mensaje: 'Verificá los registros.' };
    expect(detalleATexto(detail)).toBe('Se detectaron comprobantes duplicados. Verificá los registros.');
  });

  it('nunca devuelve [object Object]', () => {
    expect(detalleATexto({ cualquier: 'cosa' })).toBe('');
    expect(detalleATexto([{ algo: 1 }])).not.toContain('[object Object]');
    expect(detalleATexto(undefined)).toBe('');
  });
});
