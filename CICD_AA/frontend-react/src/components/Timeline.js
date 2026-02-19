/**
 * Timeline.js – CI/CD iteration timeline with pass/fail badges
 */
import React from 'react';
import { useApp } from '../App';

export default function Timeline() {
    const { runState } = useApp();
    const iterations = runState.live?.iterations || runState.result?.cicd_timeline || [];

    if (!iterations.length) {
        return (
            <div className="card timeline-card">
                <h3>🕐 CI/CD Timeline</h3>
                <div className="glow-divider" />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Timeline will populate as the agent runs…</p>
            </div>
        );
    }

    const total = 5; // max iterations

    return (
        <div className="card timeline-card">
            <div className="timeline-header">
                <h3>🕐 CI/CD Timeline</h3>
                <span className="badge badge-blue">
                    {iterations.length}/{total} iterations
                </span>
            </div>
            <div className="glow-divider" />

            <div className="timeline-list">
                {iterations.map((iter, idx) => {
                    const isPassed = iter.status === 'PASS' || iter.status === 'success';
                    const ts = iter.timestamp ? new Date(iter.timestamp).toLocaleTimeString() : '—';

                    return (
                        <div key={idx} className={`tl-item ${isPassed ? 'tl-pass' : 'tl-fail'}`}>
                            {/* Connector */}
                            <div className="tl-connector">
                                <div className={`tl-dot ${isPassed ? 'dot-green' : 'dot-red'}`} />
                                {idx < iterations.length - 1 && <div className="tl-line" />}
                            </div>

                            {/* Content */}
                            <div className="tl-content">
                                <div className="tl-top">
                                    <span className="tl-iter">Iteration {iter.iteration}</span>
                                    <span className={`badge ${isPassed ? 'badge-green' : 'badge-red'}`}>
                                        {isPassed ? '✓ PASS' : '✗ FAIL'}
                                    </span>
                                </div>
                                <p className="tl-msg">{iter.message}</p>
                                <div className="tl-meta">
                                    <span>🕐 {ts}</span>
                                    {iter.failures_count > 0 && (
                                        <span style={{ color: 'var(--accent-red)' }}>⚠ {iter.failures_count} failure(s)</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* Inline styles */
const _s = document.createElement('style');
_s.textContent = `
  .timeline-card { padding: 18px; }
  .timeline-header { display: flex; align-items: center; justify-content: space-between; }
  .timeline-list { display: flex; flex-direction: column; gap: 0; margin-top: 8px; }
  .tl-item { display: flex; gap: 12px; }
  .tl-connector { display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0; }
  .tl-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
  .dot-green { background: var(--accent-green); box-shadow: var(--glow-green); }
  .dot-red   { background: var(--accent-red);   box-shadow: var(--glow-red);   }
  .tl-line   { width: 2px; flex: 1; background: var(--border); margin: 4px 0; min-height: 20px; }
  .tl-content { flex: 1; padding-bottom: 16px; }
  .tl-top   { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .tl-iter  { font-weight: 700; font-size: 0.88rem; }
  .tl-msg   { font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 4px; }
  .tl-meta  { display: flex; gap: 16px; font-size: 0.75rem; color: var(--text-muted); }
`;
document.head.appendChild(_s);
