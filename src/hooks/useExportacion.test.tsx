import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExportacion } from './useExportacion';

describe('useExportacion', () => {
  it('marca exportando mientras dura la descarga y lo desmarca al final', async () => {
    const { result } = renderHook(() => useExportacion());
    let resolver!: () => void;
    const descarga = () => new Promise<void>(r => { resolver = r; });
    let promesa!: Promise<void>;
    act(() => { promesa = result.current.exportar(descarga, 'err'); });
    expect(result.current.exportando).toBe(true);
    await act(async () => { resolver(); await promesa; });
    expect(result.current.exportando).toBe(false);
  });

  it('un fallo se registra en consola y no deja el estado trabado', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useExportacion());
    await act(async () => {
      await result.current.exportar(async () => { throw new Error('red caída'); }, 'Error al exportar:');
    });
    expect(spy).toHaveBeenCalledWith('Error al exportar:', expect.any(Error));
    expect(result.current.exportando).toBe(false);
    spy.mockRestore();
  });
});
