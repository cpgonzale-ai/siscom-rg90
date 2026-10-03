import { describe, it, expect } from 'vitest';
import { esCancelacion, cancelarOperacionEnCurso, senalOperacionEnCurso, ejecutarConAvance } from './progreso';

describe('esCancelacion', () => {
  it('reconoce el AbortError por nombre', () => {
    expect(esCancelacion(new DOMException('x', 'AbortError'))).toBe(true);
    expect(esCancelacion(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
  });

  it('no confunde otros errores con una cancelación', () => {
    expect(esCancelacion(new Error('Error de red'))).toBe(false);
    expect(esCancelacion(null)).toBe(false);
    expect(esCancelacion('AbortError')).toBe(false);
  });
});

describe('controlador de la operación en curso', () => {
  it('no hay señal ni cancelación cuando no hay operación activa', () => {
    expect(senalOperacionEnCurso()).toBeUndefined();
    expect(() => cancelarOperacionEnCurso()).not.toThrow();
  });

  it('durante ejecutarConAvance hay señal, y se cancela al abortar', async () => {
    let senalDentro: AbortSignal | undefined;
    const promesa = ejecutarConAvance(async () => {
      senalDentro = senalOperacionEnCurso();
      cancelarOperacionEnCurso();
      return 'ok';
    }, () => {});
    await promesa;
    expect(senalDentro).toBeDefined();
    expect(senalDentro?.aborted).toBe(true);
    expect(senalOperacionEnCurso()).toBeUndefined();
  });
});
