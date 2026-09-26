import React from 'react';

interface Props { children: React.ReactNode }
interface State { error: Error | null }

// Único mecanismo de React para esto: tiene que ser una clase, no hay hook equivalente.
// Sin esto, cualquier error no capturado durante el render (un .map() sobre undefined, un
// acceso a propiedad de un objeto que llegó null desde la API) tira abajo TODO el árbol de
// React de una sola vez — pantalla en blanco total, sin ningún mensaje.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'inherit' }}>
          <h2 style={{ color: '#b3402f' }}>Ocurrió un error inesperado</h2>
          <p style={{ color: '#5c6470' }}>Recargá la página para continuar. Si el problema persiste, avisá a soporte.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '16px', padding: '10px 20px', cursor: 'pointer' }}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
