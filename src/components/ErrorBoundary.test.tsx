import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Roto(): never {
  throw new Error('fallo de render');
}

describe('ErrorBoundary', () => {
  it('muestra el mensaje de error en vez de tirar el árbol cuando un hijo falla', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <p>navegación</p>
        <ErrorBoundary>
          <Roto />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByText('Ocurrió un error inesperado')).toBeTruthy();
    expect(screen.getByText('navegación')).toBeTruthy();
    spy.mockRestore();
  });

  it('muestra los hijos normalmente cuando no hay error', () => {
    render(<ErrorBoundary><p>todo bien</p></ErrorBoundary>);
    expect(screen.getByText('todo bien')).toBeTruthy();
  });
});
