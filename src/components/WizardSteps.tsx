import React from 'react';

interface Step {
  n: number;
  label: string;
  circleStyle: string;
  labelStyle: string;
  mark: string;
  goTo?: () => void;
}

interface WizardStepsProps {
  steps: Step[];
}

export const WizardSteps: React.FC<WizardStepsProps> = ({ steps }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e0da',
        borderRadius: '10px',
        padding: '16px 24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {steps.map((st, idx) => (
        <React.Fragment key={st.n}>
          <div
            onClick={st.goTo}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: st.goTo ? 'pointer' : 'default',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                transition: 'all 0.15s ease',
                ...parseInlineStyle(st.circleStyle),
              }}
            >
              {st.mark}
            </div>
            <span
              style={{
                fontSize: '13px',
                transition: 'all 0.15s ease',
                ...parseInlineStyle(st.labelStyle),
              }}
            >
              {st.n}. {st.label}
            </span>
          </div>

          {idx < steps.length - 1 && (
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e0da', minWidth: '20px' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

function parseInlineStyle(styleStr: string): React.CSSProperties {
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
