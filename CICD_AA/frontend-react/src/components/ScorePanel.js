/**
 * ScorePanel.js – Score breakdown with RadialBarChart (Recharts)
 */
import React from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { useApp } from '../App';

export default function ScorePanel() {
    const { runState } = useApp();
    const score = runState.result?.score_breakdown;

    if (!score) {
        return (
            <div className="card score-card">
                <h3>🏆 Score Breakdown</h3>
                <div className="glow-divider" />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Score will appear after the run completes.</p>
            </div>
        );
    }

    const total = Math.max(0, Math.min(score.total, 120));
    const data = [{ name: 'Score', value: total, fill: total >= 90 ? 'var(--accent-green)' : total >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)' }];

    return (
        <div className="card score-card">
            <h3>🏆 Score Breakdown</h3>
            <div className="glow-divider" />

            <div className="score-body">
                {/* Radial chart */}
                <div className="score-chart-wrap">
                    <ResponsiveContainer width="100%" height={130}>
                        <RadialBarChart
                            cx="50%" cy="80%"
                            innerRadius="60%" outerRadius="80%"
                            startAngle={180} endAngle={0}
                            barSize={14}
                            data={data}
                        >
                            <PolarAngleAxis type="number" domain={[0, 120]} angleAxisId={0} tick={false} />
                            <RadialBar
                                background={{ fill: 'var(--bg-primary)' }}
                                dataKey="value"
                                angleAxisId={0}
                                cornerRadius={8}
                            />
                        </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="score-number" style={{ color: data[0].fill }}>{total}</div>
                    <div className="score-label">/ 120</div>
                </div>

                {/* Breakdown list */}
                <div className="score-rows">
                    <ScoreRow label="Base Score" value={`+${score.base}`} positive />
                    <ScoreRow label="Speed Bonus (<5 min)" value={score.time_bonus ? `+${score.time_bonus}` : '—'} positive={score.time_bonus > 0} />
                    <ScoreRow label="Commit Penalty" value={score.commit_penalty ? `-${score.commit_penalty}` : '—'} negative={score.commit_penalty > 0} />
                    <div className="score-total-row">
                        <span>Total</span>
                        <span style={{ color: data[0].fill, fontWeight: 800, fontSize: '1.1rem' }}>{total}</span>
                    </div>
                    {score.breakdown_notes?.map((note, i) => (
                        <p key={i} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{note}</p>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ScoreRow({ label, value, positive, negative }) {
    const color = positive ? 'var(--accent-green)'
        : negative ? 'var(--accent-red)'
            : 'var(--text-secondary)';
    return (
        <div className="score-row">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{label}</span>
            <span style={{ color, fontWeight: 600, fontSize: '0.88rem' }}>{value}</span>
        </div>
    );
}

/* Inline styles */
const _s = document.createElement('style');
_s.textContent = `
  .score-card { padding: 18px; }
  .score-body { display: flex; align-items: flex-start; gap: 24px; margin-top: 8px; }
  .score-chart-wrap { position: relative; flex: 0 0 150px; text-align: center; }
  .score-number { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); font-size: 2rem; font-weight: 800; line-height: 1; }
  .score-label  { font-size: 0.72rem; color: var(--text-muted); }
  .score-rows   { flex: 1; display: flex; flex-direction: column; gap: 6px; padding-top: 8px; }
  .score-row    { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--border); }
  .score-total-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 4px; border-top: 1px solid var(--border-bright); margin-top: 4px; font-weight: 700; }
`;
document.head.appendChild(_s);
