import { useState } from 'react';
import { IconPlus, IconEdit, IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { api } from '../lib/api.js';
import { BusinessEntryModal } from './BusinessEntryModal.jsx';

export function CareerSection({ member, businesses, canEdit, onChange }) {
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', entry: null|{...} }
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteTimers, setDeleteTimers] = useState({});
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setModal({ mode: 'create', entry: null });
  }

  function openEdit(entry) {
    setModal({ mode: 'edit', entry });
  }

  function closeModal() {
    setModal(null);
  }

  function handleSuccess() {
    closeModal();
    onChange();
  }

  function requestDelete(bid) {
    setPendingDeleteId(bid);
    const timer = setTimeout(() => setPendingDeleteId(null), 5000);
    setDeleteTimers((t) => ({ ...t, [bid]: timer }));
  }

  function cancelDelete(bid) {
    clearTimeout(deleteTimers[bid]);
    setDeleteTimers((t) => { const c = { ...t }; delete c[bid]; return c; });
    setPendingDeleteId(null);
  }

  async function confirmDelete(bid) {
    cancelDelete(bid);
    setDeleting(true);
    try {
      await api.deleteBusiness(member.fid, member.mid, bid);
      onChange();
    } catch (err) {
      console.error('Delete failed:', err.message);
    } finally {
      setDeleting(false);
    }
  }

  const isEmpty = businesses.length === 0;

  if (isEmpty && !canEdit) return null;

  return (
    <section>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="parivar-section-label mb-0">Career</div>
        {canEdit && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={openCreate}
          >
            <IconPlus size={14} /> Add entry
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="small text-body-secondary">
          No career info added yet.{' '}
          <button
            type="button"
            className="btn btn-link btn-sm p-0 small text-body-secondary text-decoration-none"
            onClick={openCreate}
          >
            Add entry →
          </button>
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {businesses.map((b) => (
            <div key={b.bid} className="border rounded p-3" style={{ background: 'var(--bs-body-bg)' }}>
              <div className="d-flex align-items-start justify-content-between gap-2">
                <div className="flex-grow-1 min-width-0">
                  <div className="fw-medium d-flex align-items-center flex-wrap gap-2">
                    <span>
                      {[b.role, b.name].filter(Boolean).join(' at ') || b.category || 'Career entry'}
                    </span>
                    {b.isCurrent && (
                      <span
                        className="badge fw-normal"
                        style={{
                          background: 'var(--parivar-accent-bg)',
                          color: 'var(--parivar-accent-text)',
                          fontSize: '0.7em',
                        }}
                      >
                        Currently
                      </span>
                    )}
                  </div>
                  {(b.city || b.category) && (
                    <div className="small text-body-secondary mt-1 d-flex flex-wrap gap-2">
                      {b.city && <span>{b.city}</span>}
                      {b.city && b.category && <span>·</span>}
                      {b.category && <span>{b.category}</span>}
                    </div>
                  )}
                  {b.description && (
                    <div className="small text-body-secondary mt-1">{b.description}</div>
                  )}
                </div>

                {canEdit && (
                  <div className="d-flex align-items-center gap-1 flex-shrink-0">
                    {pendingDeleteId === b.bid ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger d-flex align-items-center gap-1"
                          onClick={() => confirmDelete(b.bid)}
                          disabled={deleting}
                          style={{ fontSize: '0.75rem' }}
                        >
                          <IconCheck size={12} /> Confirm?
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => cancelDelete(b.bid)}
                        >
                          <IconX size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => openEdit(b)}
                          title="Edit"
                          style={{ minWidth: 44, minHeight: 44 }}
                        >
                          <IconEdit size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => requestDelete(b.bid)}
                          title="Delete"
                          style={{ minWidth: 44, minHeight: 44 }}
                        >
                          <IconTrash size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <BusinessEntryModal
        mode={modal?.mode ?? 'create'}
        entry={modal?.entry ?? null}
        member={member}
        open={modal !== null}
        onClose={closeModal}
        onSuccess={handleSuccess}
      />
    </section>
  );
}
