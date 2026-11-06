import { useState, useEffect, useRef } from 'react';
import { Modal } from 'bootstrap';
import { api } from '../lib/api.js';

const EMPTY_FORM = {
  degreeOrCourse: '',
  field: '',
  institution: '',
  year: '',
};

function buildInitialForm(mode, entry) {
  if (mode === 'edit' && entry) {
    return {
      degreeOrCourse: entry.degreeOrCourse ?? '',
      field: entry.field ?? '',
      institution: entry.institution ?? '',
      year: entry.year ?? '',
    };
  }
  return { ...EMPTY_FORM };
}

export function EducationEntryModal({ mode, entry, member, open, onClose, onSuccess }) {
  const [form, setForm] = useState(() => buildInitialForm(mode, entry));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const modalRef = useRef(null);
  const bsModal = useRef(null);
  const onCloseRef = useRef(onClose);

  // Cleaning overflow: hidden to fix the scroll bar lock bug
  useEffect(() => {
    // This return function runs exactly when the component unmounts/closes
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, []);

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
    if (!form.degreeOrCourse.trim() && !form.institution.trim()) {
      setError('Add at least a degree/course or institution.');
      return;
    }

    setSaving(true);
    setError(null);

    const body = {
      degreeOrCourse: form.degreeOrCourse.trim() || null,
      field: form.field.trim() || null,
      institution: form.institution.trim() || null,
      year: form.year.trim() || null,
    };

    try {
      let result;
      if (mode === 'create') {
        result = await api.addEducation(member.fid, member.mid, body);
      } else {
        result = await api.updateEducation(member.fid, member.mid, entry.eid, body);
      }
      onSuccess(result.education);
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
              {mode === 'create' ? 'Add education' : 'Edit education'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>

          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label small fw-medium">Degree / course</label>
              <input
                type="text"
                className="form-control"
                value={form.degreeOrCourse}
                onChange={(e) => setField('degreeOrCourse', e.target.value)}
                placeholder="e.g. B.Tech, MBA, MBBS, B.Com"
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-medium">Field of study</label>
              <input
                type="text"
                className="form-control"
                value={form.field}
                onChange={(e) => setField('field', e.target.value)}
                placeholder="e.g. Computer Science"
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-medium">Institution</label>
              <input
                type="text"
                className="form-control"
                value={form.institution}
                onChange={(e) => setField('institution', e.target.value)}
                placeholder="e.g. Nagpur University"
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-medium">Year</label>
              <input
                type="text"
                className="form-control"
                value={form.year}
                onChange={(e) => setField('year', e.target.value)}
                placeholder="e.g. 2018, 2018-2022, In progress"
              />
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
              {mode === 'create' ? 'Add education' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
