import type React from 'react';

// Convierte un string de estilo inline ("font-size: 12px; color: red") en un objeto de
// estilos de React. Se usa para los estilos que vienen de la app como texto (ver los
// componentes que lo consumen), sin depender de un parser CSS externo.
export function parseInlineStyle(styleStr: string): React.CSSProperties {
  const styles: React.CSSProperties = {};
  if (!styleStr) return styles;
  styleStr.split(';').forEach(rule => {
    const [key, val] = rule.split(':');
    if (key && val) {
      const camelKey = key.trim().replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      (styles as any)[camelKey] = val.trim();
    }
  });
  return styles;
}
