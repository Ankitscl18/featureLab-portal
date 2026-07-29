import { useState, useEffect } from 'react';
import './App.css';

function AdminApp() {
  const [token, setToken] = useState(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null); // full profile of the app being viewed

  const handleLoginChange = (e) => setLoginData({ ...loginData, [e.target.name]: e.target.value });

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('https://featurelab-portal.onrender.com/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Login failed'); return; }
      setToken(data.token);
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const fetchApplications = async (authToken) => {
    try {
      const response = await fetch('https://featurelab-portal.onrender.com/admin/applications', {
        headers: { 'admin-token': authToken }
      });
      const data = await response.json();
      if (response.ok) {
        setApplications(data);
      } else {
        setError(data.error || 'Could not load applications');
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  useEffect(() => {
    if (token) fetchApplications(token);
  }, [token]);

  const viewApplication = async (registration_number) => {
    setError('');
    try {
      const response = await fetch(`https://featurelab-portal.onrender.com/admin/applications/${registration_number}`, {
        headers: { 'admin-token': token }
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Could not load application'); return; }
      setSelectedApp(data);
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const updateStatus = async (registration_number, status) => {
    setError('');
    try {
      const response = await fetch(`https://featurelab-portal.onrender.com/admin/applications/${registration_number}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'admin-token': token },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Could not update status'); return; }

      // Refresh both the list and the open detail view (if any) so the badge updates immediately
      fetchApplications(token);
      if (selectedApp && selectedApp.student.registration_number === registration_number) {
        setSelectedApp({ ...selectedApp, student: { ...selectedApp.student, application_status: status } });
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const logout = async () => {
    try {
      await fetch('https://featurelab-portal.onrender.com/admin/logout', {
        method: 'POST',
        headers: { 'admin-token': token }
      });
    } catch (err) {
      console.error(err);
    }
    setToken(null);
    setApplications([]);
    setSelectedApp(null);
    setLoginData({ username: '', password: '' });
  };

  const statusBadgeClass = (status) => {
    if (status === 'approved') return 'admin-badge admin-badge-approved';
    if (status === 'rejected') return 'admin-badge admin-badge-rejected';
    return 'admin-badge admin-badge-pending';
  };

  // ===================== ADMIN LOGIN SCREEN =====================
  if (!token) {
    return (
      <div className="page">
        <div className="card">
          <div className="logo">
            <div className="logo-icon">🛡️</div>
            <h1>Admin<span>Panel</span></h1>
            <p className="tagline">FutureLab Application Review</p>
          </div>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleAdminLogin}>
            <div className="field"><label>Username</label><input type="text" name="username" value={loginData.username} onChange={handleLoginChange} required placeholder="Admin username" /></div>
            <div className="field"><label>Password</label><input type="password" name="password" value={loginData.password} onChange={handleLoginChange} required placeholder="Admin password" /></div>
            <button type="submit" className="signup-btn">Log In →</button>
          </form>
        </div>
      </div>
    );
  }

  // ===================== ADMIN DASHBOARD =====================
  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🛡️</span>
          <span className="brand-name">Admin<span>Panel</span></span>
        </div>
        <div className="topbar-right">
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-body">
        <main className="main-panel" style={{ width: '100%' }}>
          {error && <div className="error-box">{error}</div>}

          {!selectedApp && (
            <div className="panel-card">
              <h2 className="panel-title">Applications ({applications.length})</h2>

              {applications.length === 0 ? (
                <p className="coming-soon">No submitted applications yet.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Reg. Number</th>
                        <th>Name</th>
                        <th>Mobile</th>
                        <th>Locked</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app) => (
                        <tr key={app.registration_number}>
                          <td>{app.registration_number}</td>
                          <td>{app.name}</td>
                          <td>{app.mobile}</td>
                          <td>{app.final_submitted ? '✅' : '—'}</td>
                          <td>{app.payment_status === 'paid' ? '✅ Paid' : '—'}</td>
                          <td><span className={statusBadgeClass(app.application_status)}>{app.application_status}</span></td>
                          <td>
                            <button className="secondary-btn" onClick={() => viewApplication(app.registration_number)}>View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedApp && (
            <div className="panel-card">
              <button className="secondary-btn" onClick={() => setSelectedApp(null)}>← Back to list</button>

              <div className="reg-strip" style={{ marginTop: '16px' }}>
                <span>Registration Number: <strong>{selectedApp.student.registration_number}</strong></span>
                <span className={statusBadgeClass(selectedApp.student.application_status)} style={{ marginLeft: '12px' }}>
                  {selectedApp.student.application_status}
                </span>
              </div>

              <div className="summary-section">
                <h3 className="section-title">Personal Details</h3>
                <div className="summary-grid">
                  <div><span>Name</span><strong>{selectedApp.student.name}</strong></div>
                  <div><span>Parent's Name</span><strong>{selectedApp.student.parent_name}</strong></div>
                  <div><span>Mobile</span><strong>{selectedApp.student.mobile}</strong></div>
                  <div><span>Email</span><strong>{selectedApp.student.email || '-'}</strong></div>
                  <div><span>Govt ID Type</span><strong>{selectedApp.student.govt_id_type || '-'}</strong></div>
                  <div><span>Govt ID Number</span><strong>{selectedApp.student.govt_id_number || '-'}</strong></div>
                  <div><span>Current Address</span><strong>{[selectedApp.student.current_village, selectedApp.student.current_district, selectedApp.student.current_state].filter(Boolean).join(', ') || '-'}</strong></div>
                  <div><span>Permanent Address</span><strong>{[selectedApp.student.permanent_village, selectedApp.student.permanent_district, selectedApp.student.permanent_state].filter(Boolean).join(', ') || '-'}</strong></div>
                </div>

                <h3 className="section-title">Education Details</h3>
                {selectedApp.education ? (
                  <div className="summary-grid">
                    <div><span>10th School</span><strong>{selectedApp.education.tenth_school || '-'}</strong></div>
                    <div><span>10th Percentage</span><strong>{selectedApp.education.tenth_percentage || '-'}</strong></div>
                    <div><span>12th School</span><strong>{selectedApp.education.twelfth_school || '-'}</strong></div>
                    <div><span>12th Percentage</span><strong>{selectedApp.education.twelfth_percentage || '-'}</strong></div>
                    <div><span>Graduation</span><strong>{selectedApp.education.graduation_university || '-'}</strong></div>
                    <div><span>Graduation %</span><strong>{selectedApp.education.graduation_percentage || '-'}</strong></div>
                  </div>
                ) : <p className="coming-soon">No education details submitted.</p>}

                <h3 className="section-title">Documents Uploaded</h3>
                {selectedApp.documents.length > 0 ? (
                  <div className="summary-grid">
                    {selectedApp.documents.map(doc => (
                      <div key={doc.doc_type}>
                        <span>{doc.doc_type}</span>
                        <strong>
                          <a href={`https://featurelab-portal.onrender.com/${doc.file_path.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer">View File</a>
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : <p className="coming-soon">No documents uploaded.</p>}
              </div>

              <div className="final-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => updateStatus(selectedApp.student.registration_number, 'rejected')}
                  disabled={selectedApp.student.application_status === 'rejected'}
                >
                  ✕ Reject
                </button>
                <button
                  type="button"
                  className="signup-btn wide"
                  onClick={() => updateStatus(selectedApp.student.registration_number, 'approved')}
                  disabled={selectedApp.student.application_status === 'approved'}
                >
                  ✓ Approve
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminApp;