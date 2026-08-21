import React, { useRef } from 'react';
import { GitCompare, UploadCloud, RefreshCw, X } from 'lucide-react';
import { WizardSteps } from '../components/WizardSteps';

interface RG90ViewProps {
  wizardSteps: any[];
  rg90Loaded: boolean;
  rg90Attached: boolean;
  rg90StatusText: string;
  rg90FileLabel: string;
  rg90DropzoneStyle: string;
  rg90AnalyzeBtnStyle: string;
  rg90Analyzing: boolean;
  rg90Error: string | null;
  simulateRg90: () => void;
  onRg90FileUpload: (files: FileList) => void;
  analyzeRg90: () => void;
  resetRg90: () => void;
  rg90Cards: any[];
  rg90Diff: any[];
  rg90ByLocal: any[];
  rg90Search: string;
  onRg90Search: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearRg90Search: () => void;
  rg90CategoryFilter: string;
  clearRg90Category: () => void;
}

export const RG90View: React.FC<RG90ViewProps> = ({
  wizardSteps,
  rg90Loaded,
  rg90StatusText,
  rg90FileLabel,
  rg90DropzoneStyle,
  rg90AnalyzeBtnStyle,
  rg90Analyzing,
  rg90Error,
  simulateRg90,
  onRg90FileUpload,
  analyzeRg90,
  resetRg90,
  rg90Cards,
  rg90Diff,
  rg90ByLocal,
  rg90Search,
  onRg90Search,
  rg90CategoryFilter,
  clearRg90Category,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 3 Step Wizard Progress Bar */}
      <WizardSteps steps={wizardSteps} />

      {/* Upload RG90 Section */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e0da',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitCompare size={20} color="#128752" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>
                3. Comparación contra registros de la RG90 (SET)
              </h3>
            </div>
            <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
              {rg90StatusText}
            </p>
          </div>

          {rg90Loaded && (
            <button
              onClick={resetRg90}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e0da',
                color: '#b3402f',
                borderRadius: '7px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={14} />
              <span>Quitar archivo RG90</span>
            </button>
          )}
        </div>

        {/* Dropzone & Analyze Button */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={parseInlineStyle(rg90DropzoneStyle)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <UploadCloud size={18} color="#128752" />
              <span>{rg90FileLabel}</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                simulateRg90();
                onRg90FileUpload(e.target.files);
              }
            }}
          />

          <button onClick={analyzeRg90} disabled={rg90Analyzing} style={parseInlineStyle(rg90AnalyzeBtnStyle)}>
            {rg90Analyzing ? 'Comparando…' : 'Analizar y comparar'}
          </button>
        </div>

        {rg90Error && (
          <div
            style={{
              marginTop: '14px',
              backgroundColor: '#fbe9e3',
              border: '1px solid #eec3b5',
              color: '#8a3a26',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12.5px',
            }}
          >
            {rg90Error}
          </div>
        )}
      </div>

      {/* RG90 Summary Filter Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {rg90Cards.map((c: any, idx: number) => (
          <div
            key={idx}
            onClick={c.onClick}
            style={{
              backgroundColor: c.isActive ? '#e8f3ec' : '#ffffff',
              border: `1px solid ${c.isActive ? '#128752' : '#e2e0da'}`,
              borderRadius: '10px',
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: c.isActive ? '0 2px 8px rgba(18, 135, 82, 0.15)' : 'none',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>{c.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: c.color, marginTop: '4px' }}>
              {rg90Loaded ? c.value : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Discrepancies Table */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e0da',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fafbfa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>
              Detalle de Discrepancias e Inconsistencias
            </h4>
            {rg90CategoryFilter && (
              <span
                style={{
                  backgroundColor: '#e8f3ec',
                  color: '#128752',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Filtro: {rg90CategoryFilter}
                <X size={12} style={{ cursor: 'pointer' }} onClick={clearRg90Category} />
              </span>
            )}
          </div>

          <input
            type="text"
            placeholder="Buscar por doc, local..."
            value={rg90Search}
            onChange={onRg90Search}
            style={{
              padding: '7px 12px',
              border: '1px solid #e2e0da',
              borderRadius: '6px',
              fontSize: '12px',
              width: '220px',
            }}
          />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>N° Documento</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Sistema</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Local</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Monto Libro Propio</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Monto RG90 SET</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Diferencia / Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
            {rg90Diff.map((r: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#22262b' }}>{r.doc}</td>
                <td style={{ padding: '12px 16px', color: '#5c6470' }}>{r.sistema}</td>
                <td style={{ padding: '12px 16px', color: '#5c6470' }}>{r.local}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#5c6470' }}>{r.libro}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#5c6470' }}>{r.rg90}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={parseInlineStyle(r.diffChipStyle)}>{r.diferencia}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Breakdown per Local Table */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e0da', backgroundColor: '#fafbfa' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#22262b' }}>
            Resumen de Cobertura y Discrepancias por Local
          </h4>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Local</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Sistema</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Comprobantes</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Diferencias</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Saltos</th>
            </tr>
          </thead>
          <tbody>
            {rg90ByLocal.map((r: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#22262b' }}>{r.local}</td>
                <td style={{ padding: '12px 16px', color: '#5c6470' }}>{r.sistema}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#5c6470' }}>{r.comprobantes}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: r.diferencias > 0 ? '#b3402f' : '#128752' }}>
                  {r.diferencias}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: r.saltos > 0 ? '#b0740f' : '#128752' }}>
                  {r.saltos}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
