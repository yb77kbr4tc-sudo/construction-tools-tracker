import { useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('jwt');
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }
  return payload;
}

export default function App() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('session');
    return saved ? JSON.parse(saved) : null;
  });
  const [tools, setTools] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [sites, setSites] = useState([]);
  const [activity, setActivity] = useState([]);
  const [inviteToken, setInviteToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [loginForm, setLoginForm] = useState({ name: '', role: 'manager', inviteCode: '' });
  const [toolForm, setToolForm] = useState({ name: '', category: '', serial: '', condition: 'Good', location: 'Warehouse' });
  const [checkoutForm, setCheckoutForm] = useState({ toolId: '', userId: '', siteId: '', note: '' });
  const [workerCheckoutForm, setWorkerCheckoutForm] = useState({ toolId: '', siteId: '', note: '' });

  const isManager = session?.role === 'manager';

  const stats = useMemo(() => {
    const total = tools.length;
    const available = tools.filter((tool) => tool.status === 'available').length;
    return { total, available, checkedOut: total - available };
  }, [tools]);

  async function loadData() {
    try {
      setLoading(true);
      const [toolsRes, usersRes, sitesRes, activityRes, inviteRes] = await Promise.all([
        apiFetch('/tools'),
        apiFetch('/users'),
        apiFetch('/sites'),
        apiFetch('/activity'),
        apiFetch('/auth/invite'),
      ]);

      setTools(toolsRes.tools || []);
      setWorkers(usersRes.users || []);
      setSites(sitesRes.sites || []);
      setActivity(activityRes.activity || []);
      setInviteToken(inviteRes.inviteToken || '');

      if ((toolsRes.tools || []).length > 0) {
        setCheckoutForm((prev) => ({
          ...prev,
          toolId: (toolsRes.tools || [])[0].id,
          userId: (usersRes.users || [])[0]?.id || '',
          siteId: (sitesRes.sites || [])[0]?.id || '',
        }));
        setWorkerCheckoutForm((prev) => ({
          ...prev,
          toolId: (toolsRes.tools || [])[0].id,
          siteId: (sitesRes.sites || [])[0]?.id || '',
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    try {
      setLoading(true);
      const payload = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });
      localStorage.setItem('jwt', payload.token);
      localStorage.setItem('session', JSON.stringify(payload.user));
      setSession(payload.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('jwt');
    localStorage.removeItem('session');
    setSession(null);
  }

  async function handleAddTool(event) {
    event.preventDefault();
    try {
      setLoading(true);
      const payload = await apiFetch('/tools', {
        method: 'POST',
        body: JSON.stringify(toolForm),
      });
      setTools((prev) => [payload.tool, ...prev]);
      setToolForm({ name: '', category: '', serial: '', condition: 'Good', location: 'Warehouse' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    try {
      setLoading(true);
      const payload = await apiFetch('/tools/check-out', {
        method: 'POST',
        body: JSON.stringify({
          toolId: checkoutForm.toolId,
          userId: checkoutForm.userId,
          siteId: checkoutForm.siteId,
          note: checkoutForm.note,
        }),
      });
      setTools((prev) => prev.map((tool) => (tool.id === payload.tool.id ? payload.tool : tool)));
      setActivity((prev) => [payload.activity, ...prev]);
      setCheckoutForm((prev) => ({ ...prev, note: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(toolId, note) {
    try {
      setLoading(true);
      const payload = await apiFetch(`/tools/${toolId}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      setTools((prev) => prev.map((tool) => (tool.id === payload.tool.id ? payload.tool : tool)));
      setActivity((prev) => [payload.activity, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleWorkerCheckout() {
    try {
      setLoading(true);
      const payload = await apiFetch('/tools/check-out', {
        method: 'POST',
        body: JSON.stringify({
          toolId: workerCheckoutForm.toolId,
          userId: session.id,
          siteId: workerCheckoutForm.siteId,
          note: workerCheckoutForm.note,
        }),
      });
      setTools((prev) => prev.map((tool) => (tool.id === payload.tool.id ? payload.tool : tool)));
      setActivity((prev) => [payload.activity, ...prev]);
      setWorkerCheckoutForm((prev) => ({ ...prev, note: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshInviteToken() {
    try {
      const payload = await apiFetch('/auth/invite/refresh', { method: 'POST' });
      setInviteToken(payload.inviteToken);
    } catch (err) {
      setError(err.message);
    }
  }

  const myTools = tools.filter((tool) => tool.assignedTo === session?.id);

  if (!session) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h2>Tools Tracker</h2>
          <p>Sign in to manage construction tools.</p>
          {error && <div className="alert">{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Your name</label>
              <input value={loginForm.name} onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })} placeholder="e.g. Mike Johnson" />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={loginForm.role} onChange={(e) => setLoginForm({ ...loginForm, role: e.target.value })}>
                <option value="manager">Manager</option>
                <option value="worker">Worker</option>
              </select>
            </div>
            {loginForm.role === 'worker' && (
              <div className="field">
                <label>Invite code</label>
                <input value={loginForm.inviteCode} onChange={(e) => setLoginForm({ ...loginForm, inviteCode: e.target.value })} placeholder="Enter invite code" />
              </div>
            )}
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Construction Tools Tracker</h1>
        <div className="topbar-actions">
          <div className="user-badge">
            <span>{session.name} ({session.role})</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      {isManager ? (
        <>
          <div className="tab-nav">
            <button className={tab === 'dashboard' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('dashboard')}>Dashboard</button>
            <button className={tab === 'inventory' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('inventory')}>Inventory</button>
            <button className={tab === 'team' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('team')}>Team</button>
          </div>

          {tab === 'dashboard' && (
            <>
              <section className="stats">
                <div className="stat-card"><div className="stat-label">Total Tools</div><div className="stat-value">{stats.total}</div></div>
                <div className="stat-card"><div className="stat-label">Available</div><div className="stat-value">{stats.available}</div></div>
                <div className="stat-card"><div className="stat-label">Checked Out</div><div className="stat-value">{stats.checkedOut}</div></div>
                <div className="stat-card"><div className="stat-label">Workers</div><div className="stat-value">{workers.length}</div></div>
              </section>

              <div className="layout">
                <div className="panel">
                  <h3>Add Tool</h3>
                  <form onSubmit={handleAddTool}>
                    <div className="field"><label>Tool name</label><input value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} placeholder="e.g. Dewalt Angle Grinder" /></div>
                    <div className="grid-2">
                      <div className="field"><label>Category</label><input value={toolForm.category} onChange={(e) => setToolForm({ ...toolForm, category: e.target.value })} placeholder="Power tools" /></div>
                      <div className="field"><label>Serial / Tag</label><input value={toolForm.serial} onChange={(e) => setToolForm({ ...toolForm, serial: e.target.value })} placeholder="CW-1042" /></div>
                    </div>
                    <div className="grid-2">
                      <div className="field"><label>Condition</label><select value={toolForm.condition} onChange={(e) => setToolForm({ ...toolForm, condition: e.target.value })}><option>Good</option><option>Fair</option><option>Poor</option><option>Needs Repair</option></select></div>
                      <div className="field"><label>Location</label><input value={toolForm.location} onChange={(e) => setToolForm({ ...toolForm, location: e.target.value })} placeholder="Warehouse / Site A" /></div>
                    </div>
                    <button type="submit" className="primary-btn">Add Tool</button>
                  </form>
                </div>

                <div className="panel">
                  <h3>Check In / Out</h3>
                  <div className="field"><label>Tool</label><select value={checkoutForm.toolId} onChange={(e) => setCheckoutForm({ ...checkoutForm, toolId: e.target.value })}>{tools.map((tool) => <option key={tool.id} value={tool.id}>{tool.name}</option>)}</select></div>
                  <div className="grid-2">
                    <div className="field"><label>Worker</label><select value={checkoutForm.userId} onChange={(e) => setCheckoutForm({ ...checkoutForm, userId: e.target.value })}>{workers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div>
                    <div className="field"><label>Site</label><select value={checkoutForm.siteId} onChange={(e) => setCheckoutForm({ ...checkoutForm, siteId: e.target.value })}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
                  </div>
                  <div className="grid-2">
                    <button className="primary-btn" onClick={handleCheckout}>Check Out</button>
                    <button className="secondary-btn" onClick={() => handleCheckIn(checkoutForm.toolId, checkoutForm.note)}>Check In</button>
                  </div>
                  <div className="field" style={{ marginTop: 14 }}><label>Notes</label><input value={checkoutForm.note} onChange={(e) => setCheckoutForm({ ...checkoutForm, note: e.target.value })} placeholder="Notes" /></div>
                </div>
              </div>

              <div className="panel">
                <h3>Recent Activity</h3>
                <div className="history-list">
                  {activity.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="history-item">
                      <strong>{entry.type === 'checkout' ? 'Checked Out' : 'Checked In'} • {entry.toolName}</strong>
                      <div className="small">{entry.workerName} • {entry.siteName}</div>
                      <div className="small">{entry.note || 'No note provided'}</div>
                      <div className="small">{new Date(entry.timestamp).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'inventory' && (
            <div className="panel">
              <h3>Tools Inventory</h3>
              <div className="tools-list">
                {tools.map((tool) => {
                  const worker = workers.find((user) => user.id === tool.assignedTo);
                  const site = sites.find((s) => s.id === tool.siteId);
                  return (
                    <div key={tool.id} className="tool-row">
                      <div>
                        <div className="tool-name">{tool.name}</div>
                        <div className="tool-meta">{tool.category} • Serial: {tool.serial} • Condition: {tool.condition}</div>
                        <div className="tool-meta">Location: {tool.location}</div>
                      </div>
                      <div><span className={`status-badge ${tool.status === 'available' ? 'status-available' : 'status-checkedout'}`}>{tool.status}</span></div>
                      <div className="tool-meta">{worker ? `Worker: ${worker.name}` : 'No worker assigned'}<br />{site ? `Site: ${site.name}` : 'No site assigned'}</div>
                      <div>
                        <button className="primary-btn" onClick={() => tool.status === 'available' ? handleCheckout() : handleCheckIn(tool.id, 'Quick return')}>
                          {tool.status === 'available' ? 'Check Out' : 'Check In'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'team' && (
            <>
              <div className="panel">
                <h3>Invite Workers</h3>
                <div className="invite-link-box">
                  <span className="invite-link-label">Invite code</span>
                  <div className="invite-link-display">
                    <input className="invite-link-input" value={inviteToken} readOnly />
                    <button className="copy-btn" onClick={() => navigator.clipboard.writeText(inviteToken)}>Copy</button>
                  </div>
                </div>
                <div className="button-group">
                  <button className="secondary-btn" onClick={refreshInviteToken}>Generate New Code</button>
                </div>
              </div>

              <div className="panel" style={{ marginTop: 20 }}>
                <h3>Active Workers</h3>
                <div className="worker-list">
                  {workers.filter((user) => user.role === 'worker').map((worker) => (
                    <div key={worker.id} className="worker-item">
                      <div className="worker-name">{worker.name}</div>
                      <div className="small">{tools.filter((tool) => tool.assignedTo === worker.id).length} assigned tools</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <section className="stats">
            <div className="stat-card"><div className="stat-label">My Tools</div><div className="stat-value">{myTools.length}</div></div>
            <div className="stat-card"><div className="stat-label">Available</div><div className="stat-value">{stats.available}</div></div>
            <div className="stat-card"><div className="stat-label">Total Tools</div><div className="stat-value">{stats.total}</div></div>
          </section>

          <div className="layout">
            <div className="panel">
              <h3>My Tools</h3>
              <div className="tools-list">
                {myTools.length === 0 ? <div className="muted">You do not have any tools checked out.</div> : myTools.map((tool) => (
                  <div key={tool.id} className="tool-row">
                    <div>
                      <div className="tool-name">{tool.name}</div>
                      <div className="tool-meta">{tool.category} • Serial: {tool.serial}</div>
                    </div>
                    <div><span className="status-badge status-checkedout">Checked Out</span></div>
                    <div className="tool-meta">{sites.find((s) => s.id === tool.siteId)?.name || 'Unknown site'}</div>
                    <div><button className="primary-btn" onClick={() => handleCheckIn(tool.id, 'Returned by worker')}>Check In</button></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h3>Check In / Out</h3>
              <div className="field"><label>Tool</label><select value={workerCheckoutForm.toolId} onChange={(e) => setWorkerCheckoutForm({ ...workerCheckoutForm, toolId: e.target.value })}>{tools.map((tool) => <option key={tool.id} value={tool.id}>{tool.name}</option>)}</select></div>
              <div className="field"><label>Site</label><select value={workerCheckoutForm.siteId} onChange={(e) => setWorkerCheckoutForm({ ...workerCheckoutForm, siteId: e.target.value })}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
              <div className="grid-2">
                <button className="primary-btn" onClick={handleWorkerCheckout}>Check Out</button>
                <button className="secondary-btn" onClick={() => handleCheckIn(workerCheckoutForm.toolId, workerCheckoutForm.note)}>Check In</button>
              </div>
              <div className="field" style={{ marginTop: 14 }}><label>Notes</label><input value={workerCheckoutForm.note} onChange={(e) => setWorkerCheckoutForm({ ...workerCheckoutForm, note: e.target.value })} placeholder="Notes for this checkout" /></div>
            </div>
          </div>

          <div className="panel">
            <h3>Recent Activity</h3>
            <div className="history-list">
              {activity.filter((entry) => entry.workerName === session.name).slice(0, 10).map((entry) => (
                <div key={entry.id} className="history-item">
                  <strong>{entry.type === 'checkout' ? 'Checked Out' : 'Checked In'} • {entry.toolName}</strong>
                  <div className="small">{entry.siteName}</div>
                  <div className="small">{entry.note || 'No note provided'}</div>
                  <div className="small">{new Date(entry.timestamp).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}





































































