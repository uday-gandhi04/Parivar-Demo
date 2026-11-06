import { useEffect, useRef } from 'react';
import { Modal } from 'bootstrap';

export function PhotoViewerModal({ isOpen, onClose, photoUrl, altText = "Profile Photo" }) {
  const modalRef = useRef(null);
  const bsModal = useRef(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest onClose callback without triggering re-initialization
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!modalRef.current) return;
    
    // Initialize the Bootstrap modal
    bsModal.current = new Modal(modalRef.current, { backdrop: true, keyboard: true });
    
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
    if (isOpen) {
      bsModal.current.show();
    } else {
      bsModal.current.hide();
    }
  }, [isOpen]);

  return (
    <div ref={modalRef} className="modal fade" tabIndex="-1" aria-hidden="true">
      {/* modal-lg allows the image to get reasonably large on desktop, centered vertically */}
      <div className="modal-dialog modal-dialog-centered modal-lg">
        {/* Transparent background so it acts like a true lightbox */}
        <div className="modal-content bg-transparent border-0 shadow-none">
          <div className="modal-header border-0 pb-2 z-3 position-relative">
            {/* btn-close-white ensures the X is visible against a dark background */}
            <button
              type="button"
              className="btn-close btn-close-white ms-auto shadow-none"
              onClick={onClose}
              aria-label="Close"
              style={{ filter: 'invert(1) grayscale(100%) brightness(200%)' }} // Fallback trick to force white
            />
          </div>
          <div className="modal-body d-flex justify-content-center p-0 position-relative" style={{ marginTop: '-40px' }}>
            {photoUrl && (
              <img
                src={photoUrl}
                alt={altText}
                className="img-fluid rounded shadow-lg"
                style={{ maxHeight: '85vh', objectFit: 'contain' }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}