import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconGitBranch, IconLock, IconUsers } from '@tabler/icons-react';
import { useAuth } from '../lib/auth.jsx';
import parivarLogo from '../asset/Parivar_icon.png';

export function LoginPage() {
  const { enterDemo } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleExplore() {
    setLoading(true);
    setError('');
    try {
      await enterDemo();
      navigate('/directory', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to start the demo. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="d-flex align-items-center justify-content-center px-3 py-5" style={{ minHeight: '100vh', background: 'var(--bs-body-bg)' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div className="text-center mb-4">
          <img src={parivarLogo} alt="Parivar" className="mb-3" style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 18 }} />
          <h1 className="h2 fw-semibold mb-2">Parivar</h1>
          <p className="text-body-secondary mb-0">Explore how a family connects across generations.</p>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-4 p-sm-5">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="small fw-semibold text-uppercase" style={{ letterSpacing: '.12em', color: 'var(--parivar-accent)' }}>Public demonstration</span>
              <span className="badge rounded-pill text-bg-success">Read only</span>
            </div>
            <h2 className="h4 fw-semibold mb-2">Explore the Vardhan family</h2>
            <p className="text-body-secondary small mb-4">Enter as Aarav Vardhan and explore 250 fictional family members across six generations and eight branches. No account, email or OTP is required.</p>

            <div className="rounded-3 p-3 mb-4" style={{ background: 'var(--bs-tertiary-bg)', border: '1px solid var(--bs-border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-circle d-flex align-items-center justify-content-center fw-semibold" style={{ width: 46, height: 46, background: 'var(--parivar-accent-bg)', color: 'var(--parivar-accent-text)' }}>A</div>
                <div className="flex-grow-1">
                  <div className="fw-semibold">Aarav Vardhan</div>
                  <div className="small text-body-secondary">Demo member · Central family branch</div>
                </div>
                <IconUsers size={20} className="text-body-secondary" />
              </div>
            </div>

            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <button type="button" className="btn w-100 py-3 fw-semibold" onClick={handleExplore} disabled={loading} style={{ background: 'var(--parivar-accent)', color: '#fff' }}>
              {loading ? 'Preparing your demo…' : 'Explore Parivar Demo'} <span aria-hidden="true">→</span>
            </button>

            <div className="d-flex justify-content-center flex-wrap gap-3 mt-3 small text-body-secondary">
              <span className="d-inline-flex align-items-center gap-1"><IconGitBranch size={14} /> 6 generations</span>
              <span className="d-inline-flex align-items-center gap-1"><IconLock size={14} /> Fictional data</span>
            </div>
          </div>
        </div>

        <p className="text-center text-body-secondary small mt-3 mb-0">All people, dates, locations and relationships in this demonstration are synthetic.</p>
      </div>
    </main>
  );
}
