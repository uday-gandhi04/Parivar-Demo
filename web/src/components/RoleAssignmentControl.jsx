import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { canSetRole } from '../lib/permissions.js';

export function RoleAssignmentControl({ member, onChange }) {
  const { member: currentUser } = useAuth();
  const [selected, setSelected] = useState(member.role ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!canSetRole(currentUser, member)) return null;

  const isDirty = selected !== (member.role ?? null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await api.setMemberRole(currentUser.fid, member.mid, selected);
      onChange(result.member);
    } catch (err) {
      setError(err.message ?? 'Failed to update role.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="parivar-section-label">Admin role</div>
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 200 }}
          value={selected ?? ''}
          onChange={(e) => setSelected(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">Regular member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={!isDirty || saving}
          onClick={handleSave}
        >
          {saving && (
            <span
              className="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            />
          )}
          Save
        </button>
        {error && <span className="small text-danger">{error}</span>}
      </div>
    </section>
  );
}
