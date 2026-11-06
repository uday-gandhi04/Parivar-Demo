import { useState, useEffect, useRef } from 'react';
import { Modal } from 'bootstrap';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';

export function DeleteMemberDialog({ member, open, onClose, onSuccess }) {
  const { member: currentUser } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const modalRef = useRef(null);
  const bsModal = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!modalRef.current) return;
    bsModal.current = new Modal(modalRef.current);
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
    if (open) {
      setError(null);
      bsModal.current.show();
    } else {
      bsModal.current.hide();
    }
  }, [open]);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteMember(currentUser.fid, member.mid);
      bsModal.current?.hide();
      onSuccess();
    } catch (err) {
      setError(err.message ?? 'Delete failed. Please try again.');
      setDeleting(false);
    }
  }

  if (!member) return null;

  return (
    <div ref={modalRef} className="modal fade" tabIndex="-1" aria-modal="true" role="dialog">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-sm">
        <div className="modal-content">
          <div className="modal-header border-0 pb-1">
            <h6 className="modal-title fw-medium">Delete member</h6>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body pt-1">
            <p className="small mb-1">
              Delete <strong>{member.name}</strong> from the family tree?
            </p>
            <p className="small text-body-secondary mb-0">
              This is permanent. Any references to them in other members will be cleared.
            </p>
            {error && (
              <div className="alert alert-danger small py-2 mt-3 mb-0">{error}</div>
            )}
          </div>
          <div className="modal-footer border-0 pt-0">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />
              )}
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
