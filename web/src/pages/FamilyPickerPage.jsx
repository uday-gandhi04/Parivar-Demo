import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconUsersGroup, IconAlertCircle } from '@tabler/icons-react';
import { api } from '../lib/api.js';

export function FamilyPickerPage() {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api
      .listFamilies()
      .then((res) => {
        if (cancelled) return;
        const populated = res.families.filter((f) => f.memberCount > 0);
        if (populated.length === 1) {
          navigate(`/${populated[0].fid}/directory`, { replace: true });
          return;
        }
        setFamilies(res.families);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load families');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="mb-4">
        <h1 className="h4 fw-medium mb-1">Choose a family</h1>
        <p className="small text-body-secondary mb-0">
          Pick which family tree you want to browse.
        </p>
      </div>

      {loading && (
        <div className="py-4 text-center small text-body-secondary">Loading...</div>
      )}

      {error && (
        <div className="d-flex align-items-start gap-3 p-3 border rounded bg-body-secondary">
          <IconAlertCircle size={18} className="text-primary flex-shrink-0 mt-1" />
          <div>
            <div className="fw-medium">Couldn't reach the API</div>
            <div className="small text-body-secondary mt-1">{error}</div>
            <div className="small text-body-tertiary mt-2">
              Make sure the backend is running with <code>npm run dev</code> in
              the project root (in a separate terminal).
            </div>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="row row-cols-1 row-cols-sm-2 g-2">
          {families.filter((f) => f.memberCount > 0).map((f) => (
            <div className="col" key={f.fid}>
              <Link to={`/${f.fid}/directory`} className="parivar-row-card">
                <span
                  className="d-inline-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: 40,
                    height: 40,
                    background: 'var(--parivar-accent-bg)',
                    color: 'var(--parivar-accent-text)',
                  }}
                >
                  <IconUsersGroup size={18} />
                </span>
                <div>
                  <div className="small fw-medium">{f.name}</div>
                  <div className="small text-body-secondary">
                    {f.fid} &middot; {f.memberCount} members
                  </div>
                </div>
              </Link>
            </div>
          ))}
          {families.every((f) => f.memberCount === 0) && (
            <div className="col-12">
              <div className="small text-body-secondary py-2">
                No families with members found. Run the importer to load data.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
