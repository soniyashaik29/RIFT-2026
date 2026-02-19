/**
 * CodeEditor.js – Monaco editor with file tree sidebar and diff view
 */
import React, { useState, useMemo } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { useApp } from '../App';

export default function CodeEditor() {
    const { runState } = useApp();
    // Memoize the files and fixes to avoid on-render fluctuations
    const files = useMemo(() => runState.live?.files || [], [runState.live?.files]);
    const fixes = useMemo(() => runState.result?.fixes_table || [], [runState.result?.fixes_table]);

    const [selectedPath, setSelectedPath] = useState(null);
    const [diffMode, setDiffMode] = useState(false);

    // Build a quick lookup: file path → original content
    const fileMap = useMemo(() => {
        const m = {};
        files.forEach(f => { m[f.path] = f.content; });
        return m;
    }, [files]);

    // Build lookup of fixed files for diff highlighting
    const fixedPaths = useMemo(() => new Set(fixes.filter(f => f.status === 'fixed').map(f => f.file)), [fixes]);

    // Get currently selected file content
    const currentFile = selectedPath ? fileMap[selectedPath] : null;

    // Group files into a simple tree by directory
    const tree = useMemo(() => buildTree(files.map(f => f.path)), [files]);

    return (
        <div className="code-editor-shell">
            {/* ── File Tree ── */}
            <div className="file-tree scrollable">
                <div className="file-tree-header">
                    <span className="section-label">📁 Repository Files</span>
                    <span className="badge badge-gray">{files.length}</span>
                </div>
                {files.length === 0 ? (
                    <p className="tree-empty">Files will appear after cloning…</p>
                ) : (
                    <TreeNode nodes={tree} fileMap={fileMap} fixedPaths={fixedPaths} selected={selectedPath} onSelect={setSelectedPath} />
                )}
            </div>

            {/* ── Editor Pane ── */}
            <div className="editor-pane">
                {/* Toolbar */}
                <div className="editor-toolbar">
                    <span className="editor-path mono">{selectedPath || 'Select a file from the tree'}</span>
                    {selectedPath && fixedPaths.has(selectedPath) && (
                        <label className="diff-toggle">
                            <input type="checkbox" checked={diffMode} onChange={e => setDiffMode(e.target.checked)} />
                            <span> Show Diff</span>
                            {diffMode && <span className="badge badge-yellow" style={{ marginLeft: 6 }}>DIFF</span>}
                        </label>
                    )}
                </div>

                {/* Monaco */}
                {!selectedPath ? (
                    <div className="editor-placeholder">
                        <div style={{ fontSize: '2.5rem' }}>📝</div>
                        <p>Select a file to view its contents</p>
                    </div>
                ) : diffMode ? (
                    <DiffEditor
                        original={currentFile}
                        modified={currentFile}   // In a real impl, store original before fix
                        language={detectLang(selectedPath)}
                        theme="vs-dark"
                        options={MONACO_OPTIONS}
                    />
                ) : (
                    <Editor
                        value={currentFile || ''}
                        language={detectLang(selectedPath)}
                        theme="vs-dark"
                        options={{ ...MONACO_OPTIONS, readOnly: true }}
                    />
                )}
            </div>

            <style>{STYLES}</style>
        </div>
    );
}

// ── Tree rendering ────────────────────────────────────────────────────────
function TreeNode({ nodes, fileMap, fixedPaths, selected, onSelect, depth = 0 }) {
    return (
        <div>
            {nodes.map(node => (
                <TreeItem key={node.path} node={node} fileMap={fileMap} fixedPaths={fixedPaths} selected={selected} onSelect={onSelect} depth={depth} />
            ))}
        </div>
    );
}

function TreeItem({ node, fileMap, fixedPaths, selected, onSelect, depth }) {
    const [open, setOpen] = useState(depth < 2);
    const isDir = !!node.children;
    const isFixed = !isDir && fixedPaths.has(node.path);
    const isSel = selected === node.path;

    return (
        <div>
            <div
                className={`tree-item ${isSel ? 'tree-item-selected' : ''} ${isFixed ? 'tree-item-fixed' : ''}`}
                style={{ paddingLeft: 10 + depth * 14 }}
                onClick={() => isDir ? setOpen(o => !o) : onSelect(node.path)}
            >
                <span className="tree-icon">{isDir ? (open ? '📂' : '📁') : getFileIcon(node.name)}</span>
                <span className="tree-name">{node.name}</span>
                {isFixed && <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '1px 5px', marginLeft: 'auto' }}>Fixed</span>}
            </div>
            {isDir && open && (
                <TreeNode nodes={node.children} fileMap={fileMap} fixedPaths={fixedPaths} selected={selected} onSelect={onSelect} depth={depth + 1} />
            )}
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function buildTree(paths) {
    const root = [];
    const map = {};

    paths.forEach(p => {
        const parts = p.split('/');
        let current = root;
        let accumulated = '';

        parts.forEach((part, i) => {
            accumulated = accumulated ? `${accumulated}/${part}` : part;
            const isLast = i === parts.length - 1;

            if (!map[accumulated]) {
                const node = { name: part, path: accumulated, children: isLast ? undefined : [] };
                map[accumulated] = node;
                current.push(node);
            }
            if (!isLast) current = map[accumulated].children;
        });
    });

    // Sort to show folders first, then files
    const sortNodes = (nodes) => {
        nodes.sort((a, b) => {
            const aIsDir = !!a.children;
            const bIsDir = !!b.children;
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(n => { if (n.children) sortNodes(n.children); });
    };

    sortNodes(root);
    return root;
}

function detectLang(path) {
    const ext = path.split('.').pop();
    return { py: 'python', js: 'javascript', ts: 'typescript', json: 'json', md: 'markdown', yaml: 'yaml', yml: 'yaml', sh: 'shell' }[ext] || 'plaintext';
}

function getFileIcon(name) {
    const ext = name.split('.').pop();
    return { py: '🐍', js: '📜', ts: '📘', json: '🗂', md: '📄', yaml: '⚙️', yml: '⚙️', sh: '💻', txt: '📝' }[ext] || '📄';
}

const MONACO_OPTIONS = {
    fontSize: 13,
    lineNumbers: 'on',
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    fontFamily: "'JetBrains Mono', monospace",
};

const STYLES = `
  .code-editor-shell { display: flex; height: 100%; overflow: hidden; }
  .file-tree { width: 240px; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--bg-secondary); display: flex; flex-direction: column; }
  .file-tree-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border); }
  .tree-empty { padding: 16px 12px; color: var(--text-muted); font-size: 0.82rem; }
  .tree-item { display: flex; align-items: center; gap: 6px; padding: 5px 10px; cursor: pointer; border-radius: 4px; font-size: 0.82rem; transition: var(--transition); }
  .tree-item:hover { background: var(--bg-card); }
  .tree-item-selected { background: rgba(79,142,247,0.15) !important; color: var(--accent-blue); }
  .tree-item-fixed .tree-name { color: var(--accent-green); }
  .tree-icon { font-size: 0.9rem; flex-shrink: 0; }
  .tree-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .editor-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .editor-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .editor-path { font-size: 0.8rem; color: var(--accent-cyan); }
  .diff-toggle { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 0.8rem; cursor: pointer; }
  .editor-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-muted); }
`;
