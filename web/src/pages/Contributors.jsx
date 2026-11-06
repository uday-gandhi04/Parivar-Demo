import { IconCode, IconGitBranch, IconUsers } from '@tabler/icons-react';

export default function Contributors() {
  return (
    <div className="container py-5" style={{ maxWidth: 760 }}>
      <div className="text-center mb-5">
        <h1 className="display-6 fw-bold mb-3">Project</h1>
        <p className="lead text-body-secondary">Parivar is a full-stack family relationship and genealogy application.</p>
      </div>
      <div className="card border-0 shadow-sm p-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 52, height: 52, background: 'var(--parivar-accent-bg)', color: 'var(--parivar-accent-text)' }}><IconCode size={24} /></div>
          <div><h2 className="h5 mb-1">Uday Gandhi</h2><span className="small text-body-secondary">Developer · Project author</span></div>
        </div>
        <p className="text-body-secondary">Built the application architecture, family relationship engine, interactive graph experience and public demonstration environment.</p>
        <div className="d-flex flex-wrap gap-3 small text-body-secondary"><span><IconGitBranch size={15} className="me-1" />Graph algorithms</span><span><IconUsers size={15} className="me-1" />Relationship discovery</span></div>
      </div>
    </div>
  );
}
