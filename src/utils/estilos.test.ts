import { describe, it, expect } from 'vitest';
import { parseInlineStyle } from './estilos';

describe('parseInlineStyle', () => {
  it('convierte propiedades kebab-case en camelCase', () => {
    expect(parseInlineStyle('font-size: 12px; background-color: red')).toEqual({ fontSize: '12px', backgroundColor: 'red' });
  });

  it('devuelve vacío para un string vacío', () => {
    expect(parseInlineStyle('')).toEqual({});
  });
});
