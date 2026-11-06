import { useState, useEffect, useRef } from 'react';
import { Modal } from 'bootstrap';
import { api } from '../lib/api.js';

const CATEGORIES = ['Service', 'Business', 'Profession', 'Retired', 'Student', 'Homemaker', 'Other'];

const EMPTY_FORM = {
  role: '',
  name: '',
  city: '',
  category: '',
  description: '',
  isCurrent: false,
};

function buildInitialForm(mode, entry) {
  if (mode === 'edit' && entry) {
    return {
      role: entry.role ?? '',
      name: entry.name ?? '',
      city: entry.city ?? '',
      category: entry.category ?? '',
      description: entry.description ?? '',
      isCurrent: entry.isCurrent ?? false,
    };
  }
  return { ...EMPTY_FORM };
}

export function BusinessEntryModal({ mode, entry, member, open, onClose, onSuccess }) {
  const [form, setForm] = useState(() => buildInitialForm(mode, entry));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const modalRef = useRef(null);
  const bsModal = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!modalRef.current) return;
    bsModal.current = new Modal(modalRef.current, { backdrop: 'static' });
    const el = modalRef.current;
    const handler = () => onCloseRef.current();
    el.addEventListener('hidden.bs.modal', handler);
    return () => {
      el.removeEventListener('hidden.bs.modal', handler);
      bsModal.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!bsModal.current) return;
    if (open) bsModal.current.show();
    else bsModal.current.hide();
  }, [open]);

  useEffect(() => {
    setForm(buildInitialForm(mode, entry));
    setError(null);
  }, [mode, entry, open]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.role.trim() && !form.name.trim() && !form.category) {
      setError('Add at least a role, company, or category.');
      return;
    }

    setSaving(true);
    setError(null);

    const body = {
      role: form.role.trim() || null,
      name: form.name.trim() || null,
      city: form.city.trim() || null,
      category: form.category || null,
      description: form.description.trim() || null,
      isCurrent: form.isCurrent,
    };

    try {
      let result;
      if (mode === 'create') {
        result = await api.addBusiness(member.fid, member.mid, body);
      } else {
        result = await api.updateBusiness(member.fid, member.mid, entry.bid, body);
      }
      onSuccess(result.business);
      bsModal.current?.hide();
    } catch (err) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={modalRef} className="modal fade" tabIndex="-1" aria-modal="true" role="dialog">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <form className="modal-content" onSubmit={handleSubmit} noValidate>
          <div className="modal-header">
            <h5 className="modal-title fw-medium">
              {mode === 'create' ? 'Add career entry' : 'Edit career entry'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>

          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label small fw-medium">Role / designation</label>
              <input
                type="text"
                className="form-control"
                value={form.role}
                onChange={(e) => setField('role', e.target.value)}
                placeholder="e.g. Software Engineer, Director"
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-medium">Company / firm</label>
              <input
                type="text"
                className="form-control"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Tata Consultancy"
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-medium">City</label>
              <input
                type="text"
                className="form-control"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                placeholder="e.g. Mumbai"
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-medium">Category</label>
              <select
                className="form-select"
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
              >
                <option value="">-- Select --</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-medium">Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Brief description (optional)"
              />
            </div>

            <div className="form-check mb-2">
              <input
                type="checkbox"
                className="form-check-input"
                id="business-isCurrent"
                checked={form.isCurrent}
                onChange={(e) => setField('isCurrent', e.target.checked)}
              />
              <label className="form-check-label small" htmlFor="business-isCurrent">
                Currently doing this
              </label>
            </div>

            {error && (
              <div className="alert alert-danger small py-2 mb-0">{error}</div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving && (
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
              )}
              {mode === 'create' ? 'Add entry' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
