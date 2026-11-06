import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import parivarLogo from '../asset/Parivar_icon.png';

export function AboutPage() {
  const { member } = useAuth();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bs-body-bg)' }}>
      <header className="border-bottom">
        <div className="container d-flex align-items-center justify-content-between py-3" style={{ maxWidth: 760 }}>
          <Link to={member ? '/directory' : '/login'} className="d-flex align-items-center gap-2 text-decoration-none text-body">
            <img src={parivarLogo} alt="Parivar logo" style={{ width: 30, height: 30, objectFit: 'contain' }} />
            <span className="fw-semibold">Parivar Demo</span>
          </Link>
          <div className="d-flex align-items-center gap-2"><ThemeToggle /><Link to={member ? '/directory' : '/login'} className="btn btn-sm btn-outline-secondary">{member ? 'Back to demo' : 'Explore demo'}</Link></div>
        </div>
      </header>
      <main className="container py-5" style={{ maxWidth: 760 }}>
        <section className="text-center mb-5">
          <img src={parivarLogo} alt="Parivar logo" className="mb-3 rounded-4" style={{ width: 72, height: 72, objectFit: 'cover' }} />
          <h1 className="display-6 fw-bold mb-2">Parivar</h1>
          <p className="lead text-body-secondary">A family graph and relationship exploration platform.</p>
          <span className="badge text-bg-success">Public read-only demonstration</span>
        </section>
        <section className="mb-5">
          <h2 className="h5 fw-semibold">About this demonstration</h2>
          <p className="text-body-secondary">This public version of Parivar uses a fully synthetic family dataset containing 250 fictional members across six generations and eight branches. It demonstrates member profiles, family graphs, relationship discovery and Hindi kinship terminology.</p>
          <p className="text-body-secondary">No real family records, photographs, phone numbers, email addresses or production database are used in this demonstration.</p>
        </section>
        <section className="mb-5">
          <h2 className="h5 fw-semibold">What you can explore</h2>
          <ul className="text-body-secondary">
            <li>Browse and search the fictional family directory.</li>
            <li>Explore the multi-generation family graph.</li>
            <li>Open member profiles and inspect computed relationships.</li>
            <li>Use the relationship explorer to understand how two members are connected.</li>
            <li>View synthetic education and business information.</li>
          </ul>
        </section>
        <section className="rounded-3 p-3 mb-5" style={{ background: 'var(--bs-tertiary-bg)', border: '1px solid var(--bs-border-color)' }}>
          <h2 className="h6 fw-semibold">Demo limitations</h2>
          <p className="small text-body-secondary mb-0">The experience is read-only. Editing, uploads, account creation, notifications and AI chat are disabled. All records are fictional and should not be treated as real genealogical information.</p>
        </section>
        <footer className="text-center text-body-secondary small border-top pt-4">
          <p className="mb-1">Parivar Demo · Built by Uday Gandhi</p>
          <a href="https://github.com/uday-gandhi04" target="_blank" rel="noreferrer">GitHub ↗</a>
        </footer>
      </main>
    </div>
  );
}
