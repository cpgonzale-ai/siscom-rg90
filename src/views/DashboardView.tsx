import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, FileSpreadsheet, ShoppingCart } from 'lucide-react';
import { Modal } from '../components/Modal';
import { TablaSaltos } from '../components/TablaSaltos';

interface DashboardViewProps {
  steps: any[];
  isFreshStart: boolean;
  converted: boolean;
  rg90Loaded: boolean;
  hasAnyUpload: boolean;
  guidanceText: string;
  nextCtaLabel: string;
  nextCtaAction: () => void;
  importStatus: any[];
  kpiLocales: string;
  kpiComprobantes: string;
  kpiSaltos: string;
  /** Accesos directos a cada asistente de carga — independientes del banner de "siguiente
      paso" de arriba (que solo guía el flujo de Ventas): siempre llevan al Paso 1 de cada
      módulo, sin importar en qué paso haya quedado la sesión. */
  onGoCargaVentas: () => void;
  onGoCargaCompras: () => void;
  canCargaVentas: boolean;
  canCargaCompras: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  steps,
  converted,
  guidanceText,
  nextCtaLabel,
  nextCtaAction,
  importStatus,
  kpiLocales,
  kpiComprobantes,
  kpiSaltos,
  onGoCargaVentas,
  onGoCargaCompras,
  canCargaVentas,
  canCargaCompras,
}) => {
  // Modal de "Ver saltos" por sistema (Aloha/Hiopos/Universal) -- mismo patrón que el modal
  // de saltos de Libro Ventas/Compras (RG90View/ComprasView), en vez de navegar a la
  // pantalla de Correlatividad.
  const [saltosModalSistema, setSaltosModalSistema] = useState<string | null>(null);
  const filaModal = importStatus.find((r: any) => r.sistema === saltosModalSistema);

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Guidance Banner */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e0da',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <ShieldCheck size={20} color="#128752" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#22262b' }}>
              Estado del Flujo de Conciliación
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: '#5c6470' }}>{guidanceText}</p>
        </div>

        <button
          onClick={nextCtaAction}
          style={{
            backgroundColor: '#f0a63d',
            color: '#1a1a1a',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 22px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 6px rgba(240, 166, 61, 0.3)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>{nextCtaLabel}</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Accesos directos: siempre al Paso 1 de cada asistente, sin depender de en qué
          paso quedó la sesión (a diferencia del botón de arriba, que solo sigue a Ventas). */}
      {(canCargaVentas || canCargaCompras) && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {canCargaVentas && (
            <button
              onClick={onGoCargaVentas}
              style={{
                flex: '1 1 260px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e0da',
                borderRadius: '10px',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px', height: '42px', borderRadius: '10px', flex: 'none',
                  backgroundColor: '#e8f3ec', color: '#128752',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#22262b' }}>Cargar libro de ventas</div>
                <div style={{ fontSize: '11.5px', color: '#9aa1ab', marginTop: '2px' }}>Reportes de Aloha, Hiopos o Formato Universal</div>
              </div>
            </button>
          )}

          {canCargaCompras && (
            <button
              onClick={onGoCargaCompras}
              style={{
                flex: '1 1 260px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e0da',
                borderRadius: '10px',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px', height: '42px', borderRadius: '10px', flex: 'none',
                  backgroundColor: '#e8f3ec', color: '#128752',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ShoppingCart size={20} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#22262b' }}>Cargar libro de compras</div>
                <div style={{ fontSize: '11.5px', color: '#9aa1ab', marginTop: '2px' }}>Reporte en Formato Universal</div>
              </div>
            </button>
          )}
        </div>
      )}

      {/* 3 Step Process Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
        }}
      >
        {steps.map((st: any) => (
          <div
            key={st.n}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e0da',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    ...parseInlineStyle(st.circleStyle),
                  }}
                >
                  {st.mark}
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: 600, ...parseInlineStyle(st.statusTextStyle) }}>
                  {st.statusText}
                </span>
              </div>
              <h4 style={{ fontSize: '13.5px', fontWeight: 600, color: '#22262b', lineHeight: 1.4 }}>
                {st.label}
              </h4>
            </div>
          </div>
        ))}
      </div>

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470', marginBottom: '4px' }}>LOCALES DE VENTA</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#128752' }}>{kpiLocales}</div>
          <div style={{ fontSize: '11.5px', color: '#9aa1ab', marginTop: '4px' }}>
            {converted ? 'Locales distintos detectados en los reportes cargados' : 'A la espera de conversión'}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470', marginBottom: '4px' }}>COMPROBANTES PROCESADOS</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#128752' }}>{kpiComprobantes}</div>
          <div style={{ fontSize: '11.5px', color: '#9aa1ab', marginTop: '4px' }}>
            {converted ? 'Comprobantes válidos del libro de ventas cargado' : 'A la espera de conversión'}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470', marginBottom: '4px' }}>SALTOS DE NUMERACIÓN</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#b0740f' }}>{kpiSaltos}</div>
          <div style={{ fontSize: '11.5px', color: '#9aa1ab', marginTop: '4px' }}>
            {converted ? 'Detectados por punto de expedición' : 'A la espera de conversión'}
          </div>
        </div>
      </div>

      {/* Import Status Table */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#22262b', marginBottom: '16px' }}>
          Estado de Ingesta por Sistema Origen
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
                <th style={{ padding: '12px', fontWeight: 600 }}>Sistema</th>
                <th style={{ padding: '12px', fontWeight: 600 }}>Locales</th>
                <th style={{ padding: '12px', fontWeight: 600 }}>Registros</th>
                <th style={{ padding: '12px', fontWeight: 600 }}>Estado</th>
                <th style={{ padding: '12px', fontWeight: 600 }}>Última Carga</th>
                <th style={{ padding: '12px', fontWeight: 600 }}>Saltos</th>
                <th style={{ padding: '12px', fontWeight: 600 }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {importStatus.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0eee8' }}>
                  <td style={{ padding: '14px 12px', fontWeight: 600, color: '#22262b' }}>{r.sistema}</td>
                  <td style={{ padding: '14px 12px', color: '#5c6470' }}>{converted ? r.locales : 0}</td>
                  <td style={{ padding: '14px 12px', color: '#5c6470' }}>{converted ? r.registros : 0}</td>
                  <td style={{ padding: '14px 12px' }}>
                    <span
                      style={{
                        backgroundColor: converted ? '#e8f3ec' : '#f0eee8',
                        color: converted ? '#128752' : '#9aa1ab',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '20px',
                      }}
                    >
                      {converted ? 'Cargado' : 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 12px', color: '#5c6470' }}>{converted ? r.ultimaCarga : '—'}</td>
                  <td style={{ padding: '14px 12px', color: r.saltos > 0 ? '#b0740f' : '#128752', fontWeight: 700 }}>
                    {converted ? r.saltos : '—'}
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <button
                      onClick={() => setSaltosModalSistema(r.sistema)}
                      disabled={!converted || r.saltos === 0}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e0da',
                        color: '#128752',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        ...(!converted || r.saltos === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                      }}
                    >
                      Ver saltos
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {saltosModalSistema && filaModal && (
      <Modal
        title={`Saltos de numeración — ${filaModal.sistema} (${filaModal.saltosRows.length})`}
        onClose={() => setSaltosModalSistema(null)}
        width="900px"
      >
        <TablaSaltos rows={filaModal.saltosRows} />
      </Modal>
    )}
    </>
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
