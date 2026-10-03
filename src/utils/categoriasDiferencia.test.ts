import { describe, it, expect } from 'vitest';
import { CATEGORIA, COLOR_CATEGORIA } from './categoriasDiferencia';

describe('categorías de diferencia compartidas', () => {
  it('cada categoría tiene un color', () => {
    for (const clave of Object.values(CATEGORIA)) {
      expect(COLOR_CATEGORIA[clave]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('los textos de las claves coinciden con los que manda el backend', () => {
    expect(CATEGORIA.DIF_IMPORTE).toBe('Diferencia de importe');
    expect(CATEGORIA.DIF_TASAS).toBe('Diferencias en tasas');
    expect(CATEGORIA.NO_EXISTE_EN_LIBRO).toBe('No existe en el libro');
  });
});
