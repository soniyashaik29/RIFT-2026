/**
 * InputForm.js – Repo URL, team name, leader name inputs + Run Agent button
 */
import React, { useState } from 'react';
import { useApp } from '../App';

export default function InputForm() {
    const { startRun, runState, configStatus } = useApp();
    const isRunning = runState.status === 'running';

    const [form, setForm] = useState({
        repoUrl: '',
        teamName: 'RIFT ORGANISERS',
        leaderName: 'Saiyam Kumar',
    });

    const branchPreview = deriveBranch(form.teamName, form.leaderName);

    function deriveBranch(team, leader) {
        const clean = s => s.replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().replace(/ /g, '_');
        if (!team && !leader) return 'TEAM_LEADER_AI_Fix';
        return `${clean(team) || 'TEAM'}_${clean(leader) || 'LEADER'}_AI_Fix`;
    }

    const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = e => {
        e.preventDefault();
        if (!form.repoUrl.trim()) return;
        startRun(form);
    };

    return (
        <div className="input-page">
            <div className="input-hero">
                <h1>🧬 Autonomous CI/CD Healing</h1>
                <p className="input-subtitle">
                    Provide a GitHub repository and let the agent discover, diagnose and fix it automatically.
                </p>

                {!configStatus.github_pat_set && (
                    <div className="error-banner" style={{ marginTop: 24, justifyContent: 'center' }}>
                        <span>⚠️</span> GitHub Token missing! Please configure it in <strong>Settings</strong> to clone private repos or push fixes.
                    </div>
                )}
            </div>

            <form className="input-form card" onSubmit={handleSubmit}>
                {/* Repo URL */}
                <div className="field-group">
                    <label className="field-label">GitHub Repository URL</label>
                    <input
                        type="url"
                        name="repoUrl"
                        placeholder="https://github.com/owner/repo"
                        value={form.repoUrl}
                        onChange={handleChange}
                        required
                        disabled={isRunning}
                    />
                </div>

                {/* Team + Leader row */}
                <div className="field-row">
                    <div className="field-group">
                        <label className="field-label">Team Name</label>
                        <input
                            type="text"
                            name="teamName"
                            placeholder="e.g. RIFT ORGANISERS"
                            value={form.teamName}
                            onChange={handleChange}
                            disabled={isRunning}
                        />
                    </div>
                    <div className="field-group">
                        <label className="field-label">Team Leader</label>
                        <input
                            type="text"
                            name="leaderName"
                            placeholder="e.g. Saiyam Kumar"
                            value={form.leaderName}
                            onChange={handleChange}
                            disabled={isRunning}
                        />
                    </div>
                </div>

                {/* Branch preview */}
                <div className="branch-preview">
                    <span className="section-label">Branch Preview</span>
                    <span className="branch-name mono">🔀 {branchPreview}</span>
                </div>

                <button type="submit" className="btn-primary run-btn" disabled={isRunning || !form.repoUrl.trim()}>
                    {isRunning ? (
                        <><span className="spinner" /> Healing in progress…</>
                    ) : (
                        '▶ Run Agent'
                    )}
                </button>
            </form>

            {/* Info cards */}
            <div className="info-grid">
                {INFO_CARDS.map(c => (
                    <div key={c.title} className="info-card card card-hover">
                        <div className="info-card-icon">{c.icon}</div>
                        <div>
                            <div className="info-card-title">{c.title}</div>
                            <div className="info-card-desc">{c.desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            <style>{STYLES}</style>
        </div>
    );
}

const INFO_CARDS = [
    { icon: '🔍', title: 'Discovery', desc: 'Auto-detects all test files in the repository' },
    { icon: '🐳', title: 'Sandboxed', desc: 'Tests run in isolated Docker containers' },
    { icon: '🤖', title: 'LLM-Powered', desc: 'Ollama / OpenAI generate precise patches' },
    { icon: '🔁', title: 'Iterative', desc: 'Up to 5 retry loops until all tests pass' },
    { icon: '📊', title: 'Scored', desc: 'Score breakdown with bonuses & penalties' },
    { icon: '🚀', title: 'Auto-Push', desc: 'Commits & pushes to a dedicated AI-Fix branch' },
];

const STYLES = `
  .input-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    overflow-y: auto;
    height: 100%;
  }
  .input-hero h1 { background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  .input-subtitle { color: var(--text-secondary); margin-top: 6px; }
  .input-form { display: flex; flex-direction: column; gap: 18px; }
  .field-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .field-label { font-size: 0.78rem; font-weight: 600; letter-spacing: 0.5px; color: var(--text-secondary); text-transform: uppercase; }
  .field-row { display: flex; gap: 16px; }
  .branch-preview { display: flex; align-items: center; gap: 12px; background: var(--bg-primary); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); }
  .branch-name { color: var(--accent-cyan); font-size: 0.85rem; }
  .run-btn { align-self: flex-start; display: flex; align-items: center; gap: 10px; padding: 12px 32px; font-size: 1rem; }
  .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .info-card { display: flex; align-items: flex-start; gap: 12px; padding: 14px; }
  .info-card-icon { font-size: 1.4rem; flex-shrink: 0; }
  .info-card-title { font-weight: 600; font-size: 0.88rem; color: var(--text-primary); margin-bottom: 2px; }
  .info-card-desc  { font-size: 0.78rem; color: var(--text-secondary); line-height: 1.5; }
`;
