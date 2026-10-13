import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  FileX2,
  Upload,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  HardDrive,
  Cpu,
  Clock,
  Activity,
  Layers,
  ArrowRight,
  Info,
  AlertTriangle,
  FileText
} from 'lucide-react';

const API_BASE = '/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [baselines, setBaselines] = useState([]);
  const [recentChecks, setRecentChecks] = useState([]);
  const [loadingBaselines, setLoadingBaselines] = useState(false);
  const [toast, setToast] = useState(null);

  // Save Baseline Form State
  const [saveFile, setSaveFile] = useState(null);
  const [saveNotes, setSaveNotes] = useState('');
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [lastSavedBaseline, setLastSavedBaseline] = useState(null);

  // Verify Form State
  const [selectedBaselineId, setSelectedBaselineId] = useState('');
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  // Benchmarks & Lab Analysis State
  const [benchmarks, setBenchmarks] = useState(null);
  const [benchmarking, setBenchmarking] = useState(false);

  // Collision Demo State
  const [collisionInputs, setCollisionInputs] = useState(
    "Message A: Transfer $1000 to Alice\nMessage B: Transfer $9999 to Bob\nMessage C: Transfer $1000 to Alice"
  );
  const [collisionResult, setCollisionResult] = useState(null);
  const [runningCollision, setRunningCollision] = useState(false);

  const saveFileInputRef = useRef(null);
  const verifyFileInputRef = useRef(null);

  // Show Toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard!`);
  };

  // Fetch Baselines
  const fetchBaselines = async () => {
    setLoadingBaselines(true);
    try {
      const res = await fetch(`${API_BASE}/baselines`);
      const data = await res.json();
      setBaselines(data.baselines || []);
      if (!selectedBaselineId && data.baselines && data.baselines.length > 0) {
        setSelectedBaselineId(data.baselines[0].id);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load saved baselines', 'error');
    } finally {
      setLoadingBaselines(false);
    }
  };

  // Fetch Recent Checks
  const fetchRecentChecks = async () => {
    try {
      const res = await fetch(`${API_BASE}/recent-checks`);
      const data = await res.json();
      setRecentChecks(data.recent_verifications || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBaselines();
    fetchRecentChecks();
  }, []);

  // Format Bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    if (!bytes) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle Save Baseline Submit
  const handleSaveBaseline = async (e) => {
    e.preventDefault();
    if (!saveFile) {
      showToast('Please select a file to generate its baseline hashes', 'error');
      return;
    }

    setSavingBaseline(true);
    const formData = new FormData();
    formData.append('file', saveFile);
    formData.append('notes', saveNotes);

    try {
      const res = await fetch(`${API_BASE}/baselines`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastSavedBaseline(data);
        showToast(`Baseline saved for "${data.baseline.filename}"!`);
        fetchBaselines();
        setSaveFile(null);
        setSaveNotes('');
        if (saveFileInputRef.current) saveFileInputRef.current.value = '';
      } else {
        showToast(data.detail || 'Error saving baseline', 'error');
      }
    } catch (err) {
      showToast('Network error while saving baseline', 'error');
    } finally {
      setSavingBaseline(false);
    }
  };

  // Handle Verify Submit
  const handleVerify = async (e) => {
    e.preventDefault();
    if (!selectedBaselineId) {
      showToast('Please select a saved baseline to compare against', 'error');
      return;
    }
    if (!verifyFile) {
      showToast('Please select the file to verify', 'error');
      return;
    }

    setVerifying(true);
    setVerifyResult(null);

    const formData = new FormData();
    formData.append('baseline_id', selectedBaselineId);
    formData.append('file', verifyFile);

    try {
      const res = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setVerifyResult(data);
        fetchRecentChecks();
        if (data.is_unchanged) {
          showToast('Verification passed: File is unchanged!', 'success');
        } else {
          showToast('Verification alert: File has been modified!', 'error');
        }
      } else {
        showToast(data.detail || 'Verification error', 'error');
      }
    } catch (err) {
      showToast('Network error during verification', 'error');
    } finally {
      setVerifying(false);
    }
  };

  // Handle Delete Baseline
  const handleDeleteBaseline = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the baseline for "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/baselines/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Baseline for "${name}" deleted`);
        fetchBaselines();
        if (selectedBaselineId === id) setSelectedBaselineId('');
      } else {
        showToast('Failed to delete baseline', 'error');
      }
    } catch (err) {
      showToast('Error deleting baseline', 'error');
    }
  };

  // Quick Action: Select baseline and switch to verify tab
  const handleQuickVerify = (baselineId) => {
    setSelectedBaselineId(baselineId);
    setVerifyResult(null);
    setActiveTab('verify');
  };

  // Run Benchmark
  const runBenchmark = async () => {
    setBenchmarking(true);
    try {
      const res = await fetch(`${API_BASE}/benchmark-presets`);
      const data = await res.json();
      setBenchmarks(data.benchmarks);
      showToast('Benchmark completed successfully!');
    } catch (err) {
      showToast('Error running benchmarks', 'error');
    } finally {
      setBenchmarking(false);
    }
  };

  // Run Collision Demo
  const handleRunCollision = async () => {
    const lines = collisionInputs.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      showToast('Please enter at least 2 messages to compare', 'error');
      return;
    }
    setRunningCollision(true);
    try {
      const res = await fetch(`${API_BASE}/collision-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: lines }),
      });
      const data = await res.json();
      setCollisionResult(data);
    } catch (err) {
      showToast('Error checking collision demo', 'error');
    } finally {
      setRunningCollision(false);
    }
  };

  const currentSelectedBaseline = baselines.find(b => b.id === selectedBaselineId);

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`alert-toast ${toast.type}`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Main Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-icon-box">
            <Shield />
          </div>
          <div className="header-titles">
            <h1>Message Integrity Checker</h1>
            <div className="header-subtitle">
              <span>Cryptography & System Security Practical</span>
              <span className="badge-tag">MD5 vs SHA-1</span>
              <span className="badge-tag">Pure Python</span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <div className="status-indicator">
            <div className="status-dot"></div>
            <span>SQLite Active</span>
          </div>
          <button className="btn-secondary" onClick={() => { fetchBaselines(); fetchRecentChecks(); }} title="Refresh Records">
            <RefreshCw size={15} />
            <span>Sync</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="tabs-navigation">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <Activity size={18} />
          <span>Dashboard</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'save' ? 'active' : ''}`}
          onClick={() => setActiveTab('save')}
        >
          <Upload size={18} />
          <span>Save File Baseline</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'verify' ? 'active' : ''}`}
          onClick={() => setActiveTab('verify')}
        >
          <ShieldCheck size={18} />
          <span>Verify Integrity</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'baselines' ? 'active' : ''}`}
          onClick={() => setActiveTab('baselines')}
        >
          <HardDrive size={18} />
          <span>Saved Baselines ({baselines.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <Cpu size={18} />
          <span>Lab Analysis & Benchmarks</span>
        </button>
      </nav>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div>
          {/* KPI Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}>
                <HardDrive size={24} />
              </div>
              <div>
                <div className="stat-value">{baselines.length}</div>
                <div className="stat-label">Saved Baselines</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="stat-value">{recentChecks.length}</div>
                <div className="stat-label">Audit Verifications</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc' }}>
                <Layers size={24} />
              </div>
              <div>
                <div className="stat-value">MD5 (128-bit)</div>
                <div className="stat-label">4 Rounds • 64 Ops • Little Endian</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#38bdf8' }}>
                <Cpu size={24} />
              </div>
              <div>
                <div className="stat-value">SHA-1 (160-bit)</div>
                <div className="stat-label">4 Rounds • 80 Ops • Big Endian</div>
              </div>
            </div>
          </div>

          {/* Quick Action Banner */}
          <div className="section-panel" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.7))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
                  Laboratory Objective: Cryptographic Integrity Verification
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '720px' }}>
                  This application determines whether a file has remained authentic and unchanged or has been modified,
                  by comparing stored cryptographic hashes with freshly calculated values. Both MD5 and SHA-1 are
                  implemented purely from scratch in Python without external cryptographic dependencies.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.85rem' }}>
                <button className="btn-primary" onClick={() => setActiveTab('save')}>
                  <Upload size={16} />
                  <span>Save Baseline</span>
                </button>
                <button className="btn-secondary" onClick={() => setActiveTab('verify')}>
                  <ShieldCheck size={16} />
                  <span>Verify File</span>
                </button>
              </div>
            </div>
          </div>

          {/* Recently Checked Files Table */}
          <div className="section-panel">
            <div className="section-header">
              <h2>
                <Clock size={20} style={{ color: 'var(--accent-cyan)' }} />
                <span>Recently Verified Files</span>
              </h2>
              <p>Audit history of recent integrity checks performed against stored baselines.</p>
            </div>

            {recentChecks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <FileCheck2 size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                <p>No integrity checks recorded yet. Run a verification from the "Verify Integrity" tab.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Checked File</th>
                      <th>Baseline Reference</th>
                      <th>MD5 Match</th>
                      <th>SHA-1 Match</th>
                      <th>Size Match</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentChecks.map((log) => (
                      <tr key={log.id}>
                        <td>
                          {log.is_unchanged ? (
                            <span className="match-status-badge match">
                              <Check size={13} /> Unchanged
                            </span>
                          ) : (
                            <span className="match-status-badge diff">
                              <AlertTriangle size={13} /> Modified
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{log.checked_filename}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{log.baseline_filename}</td>
                        <td>
                          <span className={`match-status-badge ${log.md5_matched ? 'match' : 'diff'}`}>
                            {log.md5_matched ? 'MATCH' : 'DIFF'}
                          </span>
                        </td>
                        <td>
                          <span className={`match-status-badge ${log.sha1_matched ? 'match' : 'diff'}`}>
                            {log.sha1_matched ? 'MATCH' : 'DIFF'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                            {formatBytes(log.checked_filesize)}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                          {new Date(log.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SAVE FILE BASELINE */}
      {activeTab === 'save' && (
        <div className="section-panel">
          <div className="section-header">
            <h2>
              <Upload size={20} style={{ color: 'var(--accent-indigo)' }} />
              <span>Save Original File Baseline</span>
            </h2>
            <p>
              Upload any document, image, executable, or text file. The backend will read the binary stream and execute
              the custom MD5 and SHA-1 algorithms to generate authoritative cryptographic baselines stored in SQLite.
            </p>
          </div>

          <form onSubmit={handleSaveBaseline}>
            <div
              className="dropzone-container"
              onClick={() => saveFileInputRef.current && saveFileInputRef.current.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  setSaveFile(e.dataTransfer.files[0]);
                }
              }}
            >
              <input
                ref={saveFileInputRef}
                type="file"
                className="file-input-hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSaveFile(e.target.files[0]);
                  }
                }}
              />
              <Upload size={36} className="dropzone-icon" />
              <div className="dropzone-text">
                {saveFile ? 'Change selected file' : 'Click to browse or drag and drop a file'}
              </div>
              <div className="dropzone-subtext">
                Supports all file formats (PDF, DOCX, TXT, PNG, EXE, binary payloads) of any size
              </div>
            </div>

            {saveFile && (
              <div className="selected-file-badge">
                <div className="file-info-group">
                  <FileText size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <div>
                    <div className="file-name-text">{saveFile.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Type: {saveFile.type || 'Binary / Unknown'}
                    </div>
                  </div>
                </div>
                <div className="file-size-tag">{formatBytes(saveFile.size)} ({saveFile.size} bytes)</div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Optional Description or Notes</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Master financial report before transmission to auditor"
                value={saveNotes}
                onChange={(e) => setSaveNotes(e.target.value)}
              />
            </div>

            <div style={{ marginTop: '1.75rem' }}>
              <button type="submit" className="btn-primary" disabled={!saveFile || savingBaseline}>
                {savingBaseline ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Calculating Custom Hashes & Saving...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Generate & Save Hashes</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Last Saved Result Card */}
          {lastSavedBaseline && (
            <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <div className="result-banner unchanged" style={{ margin: '0 0 1.5rem 0' }}>
                <div className="banner-icon-box">
                  <Check size={28} />
                </div>
                <div className="banner-text">
                  <h3>Baseline Successfully Created & Stored!</h3>
                  <p>
                    Baseline ID <strong>#{lastSavedBaseline.baseline.id}</strong> recorded for{' '}
                    <strong>{lastSavedBaseline.baseline.filename}</strong> ({formatBytes(lastSavedBaseline.baseline.file_size)}).
                    Stored in local SQLite database for future integrity checks.
                  </p>
                </div>
              </div>

              <div className="comparison-grid">
                <div className="digest-box">
                  <div className="digest-header">
                    <span className="digest-label">MD5 Digest (128-bit)</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {lastSavedBaseline.performance.md5_time_ms} ms
                    </span>
                  </div>
                  <div className="digest-val">
                    <span>{lastSavedBaseline.baseline.md5_hash}</span>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(lastSavedBaseline.baseline.md5_hash, 'MD5 Hash')}
                      title="Copy MD5"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="digest-box">
                  <div className="digest-header">
                    <span className="digest-label">SHA-1 Digest (160-bit)</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {lastSavedBaseline.performance.sha1_time_ms} ms
                    </span>
                  </div>
                  <div className="digest-val">
                    <span>{lastSavedBaseline.baseline.sha1_hash}</span>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(lastSavedBaseline.baseline.sha1_hash, 'SHA-1 Hash')}
                      title="Copy SHA-1"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button
                  className="btn-secondary"
                  onClick={() => handleQuickVerify(lastSavedBaseline.baseline.id)}
                >
                  <ShieldCheck size={16} />
                  <span>Verify Against This Baseline Now</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VERIFY FILE INTEGRITY */}
      {activeTab === 'verify' && (
        <div className="section-panel">
          <div className="section-header">
            <h2>
              <ShieldCheck size={20} style={{ color: 'var(--accent-cyan)' }} />
              <span>Verify File Integrity</span>
            </h2>
            <p>
              Select a stored baseline, then provide the current file copy. The backend recalculates MD5 and SHA-1 hashes
              and performs exact bitwise comparison.
            </p>
          </div>

          <form onSubmit={handleVerify}>
            <div className="form-group">
              <label className="form-label">Step 1: Choose Saved Baseline</label>
              {baselines.length === 0 ? (
                <div style={{ color: '#f87171', fontSize: '0.9rem', padding: '0.5rem 0' }}>
                  No baselines found in database. Please save a baseline first!
                </div>
              ) : (
                <select
                  className="form-select"
                  value={selectedBaselineId}
                  onChange={(e) => {
                    setSelectedBaselineId(e.target.value);
                    setVerifyResult(null);
                  }}
                >
                  {baselines.map((b) => (
                    <option key={b.id} value={b.id}>
                      [{b.id}] {b.filename} ({formatBytes(b.file_size)}) — Saved {new Date(b.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {currentSelectedBaseline && (
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    TARGET BASELINE DETAILS
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Recorded: {new Date(currentSelectedBaseline.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div><strong>Filename:</strong> {currentSelectedBaseline.filename}</div>
                  <div><strong>Baseline Size:</strong> {formatBytes(currentSelectedBaseline.file_size)} ({currentSelectedBaseline.file_size} bytes)</div>
                  {currentSelectedBaseline.notes && (
                    <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)' }}>
                      <strong>Notes:</strong> {currentSelectedBaseline.notes}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" style={{ marginTop: '1.25rem' }}>
                Step 2: Select File To Test
              </label>
              <div
                className="dropzone-container"
                onClick={() => verifyFileInputRef.current && verifyFileInputRef.current.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setVerifyFile(e.dataTransfer.files[0]);
                  }
                }}
              >
                <input
                  ref={verifyFileInputRef}
                  type="file"
                  className="file-input-hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setVerifyFile(e.target.files[0]);
                    }
                  }}
                />
                <ShieldCheck size={36} className="dropzone-icon" />
                <div className="dropzone-text">
                  {verifyFile ? 'Change verification file' : 'Click or drop file to test its authenticity'}
                </div>
                <div className="dropzone-subtext">
                  You can select the same file, a modified file, a renamed file, or a different file
                </div>
              </div>

              {verifyFile && (
                <div className="selected-file-badge">
                  <div className="file-info-group">
                    <FileText size={20} style={{ color: 'var(--accent-indigo)' }} />
                    <div>
                      <div className="file-name-text">{verifyFile.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Current Verification Candidate
                      </div>
                    </div>
                  </div>
                  <div className="file-size-tag">{formatBytes(verifyFile.size)} ({verifyFile.size} bytes)</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.75rem' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={!verifyFile || !selectedBaselineId || verifying}
              >
                {verifying ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Recalculating Hashes & Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Verify Integrity</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* VERIFICATION RESULT DISPLAY */}
          {verifyResult && (
            <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              {/* PRIMARY STATUS BANNER */}
              {verifyResult.is_unchanged ? (
                <div className="result-banner unchanged">
                  <div className="banner-icon-box">
                    <ShieldCheck size={32} />
                  </div>
                  <div className="banner-text">
                    <h3>File is unchanged</h3>
                    <p>
                      Cryptographic verification PASSED. Both MD5 and SHA-1 digests match the recorded baseline exactly.
                      No content modification or tampering detected.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="result-banner modified">
                  <div className="banner-icon-box">
                    <ShieldAlert size={32} />
                  </div>
                  <div className="banner-text">
                    <h3>File has been modified</h3>
                    <p>
                      Integrity check FAILED. The freshly calculated hashes differ from the recorded baseline.
                      The file contents have been altered, corrupted, or replaced.
                    </p>
                  </div>
                </div>
              )}

              {/* RENAMED NOTICE */}
              {!verifyResult.metadata.is_filename_same && verifyResult.is_unchanged && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning-border)', borderRadius: '10px', padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Info size={20} style={{ color: '#fbbf24', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.88rem', color: '#fef3c7' }}>
                    <strong>Note:</strong> The file was renamed from "<em>{verifyResult.metadata.original_filename}</em>" to "<em>{verifyResult.metadata.checked_filename}</em>", but the contents remain byte-for-byte identical. Integrity is preserved!
                  </span>
                </div>
              )}

              {/* FILE METADATA COMPARISON */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '0.85rem' }}>
                  Metadata & Size Inspection
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.88rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Baseline Filename</span>
                    <strong>{verifyResult.metadata.original_filename}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Current Filename</span>
                    <strong>{verifyResult.metadata.checked_filename}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Original File Size</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{formatBytes(verifyResult.metadata.original_filesize)} ({verifyResult.metadata.original_filesize} B)</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Current File Size</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {formatBytes(verifyResult.metadata.checked_filesize)} ({verifyResult.metadata.checked_filesize} B)
                      {verifyResult.metadata.filesize_diff_bytes !== 0 && (
                        <span style={{ color: '#f87171', marginLeft: '0.4rem' }}>
                          ({verifyResult.metadata.filesize_diff_bytes > 0 ? '+' : ''}{verifyResult.metadata.filesize_diff_bytes} B)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* SIDE-BY-SIDE HASH COMPARISON */}
              <div className="comparison-grid">
                {/* MD5 CARD */}
                <div className="comparison-card">
                  <div className="comparison-card-header">
                    <span className="algo-badge md5">MD5 Algorithm (128-bit)</span>
                    <span className={`match-status-badge ${verifyResult.md5_matched ? 'match' : 'diff'}`}>
                      {verifyResult.md5_matched ? <Check size={14} /> : <AlertTriangle size={14} />}
                      {verifyResult.md5_matched ? 'MATCHED' : 'DIFFERENT'}
                    </span>
                  </div>

                  <div className="hash-row">
                    <div className="hash-row-title">Original Stored Baseline MD5:</div>
                    <div className="hash-row-code">
                      {verifyResult.comparison.original_md5}
                    </div>
                  </div>

                  <div className="hash-row">
                    <div className="hash-row-title">Current Recalculated MD5:</div>
                    <div className={`hash-row-code ${!verifyResult.md5_matched ? 'diff' : ''}`}>
                      {verifyResult.comparison.current_md5}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Calculation Time: {verifyResult.performance.md5_time_ms} ms</span>
                    <span>64 Operations / 4 Rounds</span>
                  </div>
                </div>

                {/* SHA-1 CARD */}
                <div className="comparison-card">
                  <div className="comparison-card-header">
                    <span className="algo-badge sha1">SHA-1 Algorithm (160-bit)</span>
                    <span className={`match-status-badge ${verifyResult.sha1_matched ? 'match' : 'diff'}`}>
                      {verifyResult.sha1_matched ? <Check size={14} /> : <AlertTriangle size={14} />}
                      {verifyResult.sha1_matched ? 'MATCHED' : 'DIFFERENT'}
                    </span>
                  </div>

                  <div className="hash-row">
                    <div className="hash-row-title">Original Stored Baseline SHA-1:</div>
                    <div className="hash-row-code">
                      {verifyResult.comparison.original_sha1}
                    </div>
                  </div>

                  <div className="hash-row">
                    <div className="hash-row-title">Current Recalculated SHA-1:</div>
                    <div className={`hash-row-code ${!verifyResult.sha1_matched ? 'diff' : ''}`}>
                      {verifyResult.comparison.current_sha1}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Calculation Time: {verifyResult.performance.sha1_time_ms} ms</span>
                    <span>80 Operations / 4 Rounds</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SAVED BASELINES */}
      {activeTab === 'baselines' && (
        <div className="section-panel">
          <div className="section-header">
            <h2>
              <HardDrive size={20} style={{ color: 'var(--accent-purple)' }} />
              <span>Saved Baseline Hashes in SQLite</span>
            </h2>
            <p>
              Persistent database records stored in <code>backend/integrity_checker.db</code>.
              These records survive application restarts and system reboots.
            </p>
          </div>

          {loadingBaselines ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <RefreshCw size={24} className="animate-spin" />
            </div>
          ) : baselines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <FileX2 size={44} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
              <p>No baselines saved yet. Navigate to the "Save File Baseline" tab to add one.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Filename</th>
                    <th>File Size</th>
                    <th>MD5 Hash</th>
                    <th>SHA-1 Hash</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {baselines.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                          #{b.id}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {b.filename}
                        {b.notes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                            {b.notes}
                          </div>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatBytes(b.file_size)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span className="hash-preview" title={b.md5_hash}>{b.md5_hash}</span>
                          <button
                            className="copy-btn"
                            onClick={() => copyToClipboard(b.md5_hash, 'MD5')}
                            title="Copy MD5"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span className="hash-preview" title={b.sha1_hash}>{b.sha1_hash}</span>
                          <button
                            className="copy-btn"
                            onClick={() => copyToClipboard(b.sha1_hash, 'SHA-1')}
                            title="Copy SHA-1"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {new Date(b.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                            onClick={() => handleQuickVerify(b.id)}
                            title="Verify candidate against this baseline"
                          >
                            <ShieldCheck size={13} />
                            <span>Verify</span>
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => handleDeleteBaseline(b.id, b.filename)}
                            title="Delete baseline"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: LAB ANALYSIS & BENCHMARKS */}
      {activeTab === 'analysis' && (
        <div>
          {/* TIMING COMPARISON SECTION (Page 6 of Practical PDF) */}
          <div className="section-panel">
            <div className="section-header">
              <h2>
                <Clock size={20} style={{ color: 'var(--accent-cyan)' }} />
                <span>Performance & Timing Analysis (Lab Manual Page 6)</span>
              </h2>
              <p>
                As required in practical PDF section: <em>"Timing comparison between MD5 and SHA-1 for varying message sizes"</em>.
                Evaluates execution time for 1 KB, 5 KB, 10 KB, and 50 KB payloads.
              </p>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <button className="btn-primary" onClick={runBenchmark} disabled={benchmarking}>
                {benchmarking ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Measuring Algorithm Times...</span>
                  </>
                ) : (
                  <>
                    <Activity size={16} />
                    <span>Run Lab Timing Benchmark</span>
                  </>
                )}
              </button>
            </div>

            {benchmarks && (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>File / Message Size</th>
                      <th>MD5 Time (ms) [64 Ops]</th>
                      <th>SHA-1 Time (ms) [80 Ops]</th>
                      <th>Speed Analysis</th>
                      <th>Observation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmarks.map((b, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{b.size_label} ({b.size_bytes} Bytes)</td>
                        <td style={{ color: '#c4b5fd', fontFamily: 'var(--font-mono)' }}>{b.md5_time_ms} ms</td>
                        <td style={{ color: '#67e8f9', fontFamily: 'var(--font-mono)' }}>{b.sha1_time_ms} ms</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          MD5 is {b.speed_ratio > 1 ? `${b.speed_ratio}x faster` : 'comparable'}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          SHA-1 executes 16 additional operations per block plus 80-word schedule expansion
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* LAB POST-LAB ASSIGNMENT QUESTIONS (Page 5 & 7 of PDF) */}
          <div className="section-panel">
            <div className="section-header">
              <h2>
                <Layers size={20} style={{ color: 'var(--accent-indigo)' }} />
                <span>Theoretical Comparison: MD5 vs SHA-1 (Lab Manual Page 5)</span>
              </h2>
              <p>Comparative metrics as specified in the Computer Engineering curriculum.</p>
            </div>

            <div className="table-responsive" style={{ marginBottom: '1.5rem' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Keys For Comparison</th>
                    <th>MD5</th>
                    <th>SHA-1</th>
                    <th>Cryptographic Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Message Digest Length</strong></td>
                    <td>128 Bits (16 bytes / 32 hex)</td>
                    <td>160 Bits (20 bytes / 40 hex)</td>
                    <td>SHA-1 produces a 32-bit longer digest, significantly increasing search space.</td>
                  </tr>
                  <tr>
                    <td><strong>Security Level</strong></td>
                    <td>Less Secure than SHA</td>
                    <td>More Secure than MD5</td>
                    <td>Longer digest and 5 chaining registers provide greater avalanche dispersion.</td>
                  </tr>
                  <tr>
                    <td><strong>Attacks for Original Message (Preimage)</strong></td>
                    <td>2<sup>128</sup> bit operations</td>
                    <td>2<sup>160</sup> bit operations</td>
                    <td>32 additional bits require 2<sup>32</sup> (4.29 billion) times more work for brute force.</td>
                  </tr>
                  <tr>
                    <td><strong>Attacks for Collision (Birthday Bound)</strong></td>
                    <td>2<sup>64</sup> bit operations</td>
                    <td>2<sup>80</sup> bit operations</td>
                    <td>Birthday attack complexity is 2<sup>(n/2)</sup>; 2<sup>80</sup> provides much higher resistance.</td>
                  </tr>
                  <tr>
                    <td><strong>Speed / Number of Iterations</strong></td>
                    <td>Faster, 64 operations (4 rounds × 16)</td>
                    <td>Slower, 80 operations (4 rounds × 20)</td>
                    <td>MD5 performs 20% fewer iterations per 512-bit message block.</td>
                  </tr>
                  <tr>
                    <td><strong>Buffer Architecture</strong></td>
                    <td>4 Registers: A, B, C, D</td>
                    <td>5 Registers: H0, H1, H2, H3, H4</td>
                    <td>SHA-1 maintains an extra 32-bit state variable in memory.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Answer to Question 1 from PDF */}
            <div className="theory-card">
              <h3>
                <Info size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span>Lab Question 1: Why is SHA-1 more secure than MD5?</span>
              </h3>
              <p>
                <strong>1. Larger Digest Size:</strong> SHA-1 produces a 160-bit digest compared to MD5's 128-bit digest. By the Birthday Paradox, the complexity of finding a collision increases from 2<sup>64</sup> operations in MD5 to 2<sup>80</sup> operations in SHA-1.
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                <strong>2. More Operations per Block:</strong> SHA-1 executes 80 rounds of transformations on each 512-bit block, whereas MD5 executes only 64 rounds.
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                <strong>3. Expanded Message Schedule:</strong> SHA-1 expands the 16 words of the 512-bit block into 80 pseudo-randomized words using circular left shifts: <code>W[t] = S¹(W[t-3] ⊕ W[t-8] ⊕ W[t-14] ⊕ W[t-16])</code>, ensuring heavy inter-word diffusion before register mixing.
              </p>
            </div>
          </div>

          {/* LAB ASSIGNMENT 3: HASH COLLISION DEMONSTRATION (Page 7 of PDF) */}
          <div className="section-panel">
            <div className="section-header">
              <h2>
                <ShieldAlert size={20} style={{ color: 'var(--warning)' }} />
                <span>Hash Collision Demonstration (Lab Manual Page 7, Assignment 3)</span>
              </h2>
              <p>
                Accepts multiple messages, generates MD5 and SHA-1 digests, checks whether any distinct inputs produce identical hashes,
                and demonstrates the concept of hash collisions and their impact on message integrity.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Enter Test Messages (One message per line):</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={collisionInputs}
                onChange={(e) => setCollisionInputs(e.target.value)}
              />
            </div>

            <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
              <button className="btn-primary" onClick={handleRunCollision} disabled={runningCollision}>
                {runningCollision ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Analyzing Messages...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Run Collision Check</span>
                  </>
                )}
              </button>
            </div>

            {collisionResult && (
              <div>
                <div className="table-responsive" style={{ marginBottom: '1.25rem' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Input Message</th>
                        <th>Bytes</th>
                        <th>MD5 Digest</th>
                        <th>SHA-1 Digest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collisionResult.items.map((it) => (
                        <tr key={it.index}>
                          <td>{it.index}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>"{it.message}"</td>
                          <td>{it.byte_length} B</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#c4b5fd' }}>{it.md5}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#67e8f9' }}>{it.sha1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="theory-card" style={{ borderColor: 'var(--warning-border)' }}>
                  <h3>
                    <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                    <span>Impact of Hash Collisions on Message Integrity</span>
                  </h3>
                  <p>{collisionResult.explanation}</p>
                  <p style={{ marginTop: '0.5rem', color: '#fef3c7' }}>
                    <strong>Security Advisory for Production Systems:</strong> In 2005, Xiaoyun Wang demonstrated practical MD5 collisions in minutes.
                    In 2017, Google announced the SHAttered attack producing two different PDF documents with identical SHA-1 hashes.
                    While MD5 and SHA-1 remain educational cornerstones for understanding Merkle–Damgård constructions, modern production systems
                    mandate SHA-256 (SHA-2 family) or SHA-3 (Keccak permutation) for tamper-evident digital signatures.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
