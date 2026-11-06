import { useState,useEffect } from 'react';
import { IconPlus, IconEdit, IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { api } from '../lib/api.js';
import { EducationEntryModal } from './EducationEntryModal.jsx';

export function EducationSection({ member, educations, canEdit, onChange }) {
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', entry: null|{...} }
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteTimers, setDeleteTimers] = useState({});
  const [deleting, setDeleting] = useState(false);

  // Cleaning overflow: hidden to fix the scroll bar lock bug
    useEffect(() => {
      // This return function runs exactly when the component unmounts/closes
      return () => {
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      };
    }, []);

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

  function requestDelete(eid) {
    setPendingDeleteId(eid);
    const timer = setTimeout(() => setPendingDeleteId(null), 5000);
    setDeleteTimers((t) => ({ ...t, [eid]: timer }));
  }

  function cancelDelete(eid) {
    clearTimeout(deleteTimers[eid]);
    setDeleteTimers((t) => { const c = { ...t }; delete c[eid]; return c; });
    setPendingDeleteId(null);
  }

  async function confirmDelete(eid) {
    cancelDelete(eid);
    setDeleting(true);
    try {
      await api.deleteEducation(member.fid, member.mid, eid);
      onChange();
    } catch (err) {
      console.error('Delete failed:', err.message);
    } finally {
      setDeleting(false);
    }
  }

  const isEmpty = educations.length === 0;

  if (isEmpty && !canEdit) return null;

  return (
    <section>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="parivar-section-label mb-0">Education</div>
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
          No education info added yet.{' '}
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
          {educations.map((e) => (
            <div key={e.eid} className="border rounded p-3" style={{ background: 'var(--bs-body-bg)' }}>
              <div className="d-flex align-items-start justify-content-between gap-2">
                <div className="flex-grow-1 min-width-0">
                  <div className="fw-medium">
                    {[e.degreeOrCourse, e.field].filter(Boolean).join(', ') || 'Education entry'}
                  </div>
                  {(e.institution || e.year) && (
                    <div className="small text-body-secondary mt-1 d-flex flex-wrap gap-2">
                      {e.institution && <span>{e.institution}</span>}
                      {e.institution && e.year && <span>·</span>}
                      {e.year && <span>{e.year}</span>}
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div className="d-flex align-items-center gap-1 flex-shrink-0">
                    {pendingDeleteId === e.eid ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger d-flex align-items-center gap-1"
                          onClick={() => confirmDelete(e.eid)}
                          disabled={deleting}
                          style={{ fontSize: '0.75rem' }}
                        >
                          <IconCheck size={12} /> Confirm?
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => cancelDelete(e.eid)}
                        >
                          <IconX size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => openEdit(e)}
                          title="Edit"
                          style={{ minWidth: 44, minHeight: 44 }}
                        >
                          <IconEdit size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => requestDelete(e.eid)}
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

      <EducationEntryModal
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
