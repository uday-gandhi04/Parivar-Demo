import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from 'bootstrap';
import { Link } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { useAuth } from '../lib/auth.jsx';
import { api, ApiError } from '../lib/api.js';
import { MemberPicker } from './MemberPicker.jsx';

// --- HTML5 Canvas Crop Utility ---
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  // 600x600 is the sweet spot: high enough resolution for crisp faces,
  // but small enough to compress down to ~50-100KB.
  const SIZE = 600;
  canvas.width = SIZE;
  canvas.height = SIZE;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    SIZE,
    SIZE
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', 0.9); // 0.9 quality preserves facial details beautifully
  });
}
// ---------------------------------

function toDateInput(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

const EMPTY_FORM = {
  name: '',
  dob: '',
  anniversary: '',
  gender: '',
  mobile: '',
  email: '',
  location: '',
  photoUrl: '',
  fatherId: null,
  motherId: null,
  spouseId: null,
  isDeceased: false,
};

function buildInitialForm(mode, member, preset) {
  if (mode === 'edit' && member) {
    return {
      name: member.name ?? '',
      dob: toDateInput(member.dob),
      anniversary: toDateInput(member.anniversary),
      gender: member.gender ?? '',
      mobile: member.mobile ?? '',
      email: member.email ?? '',
      location: member.location ?? '',
      photoUrl: member.photoUrl ?? '',
      fatherId: member.fatherId ?? null,
      motherId: member.motherId ?? null,
      spouseId: member.spouseId ?? null,
      isDeceased: member.isDeceased ?? false,
    };
  }
  return { ...EMPTY_FORM, ...(preset ?? {}) };
}

export function EditMemberModal({
  mode,
  member,
  preset,
  open,
  onClose,
  onSuccess,
  familyMembers = [],
}) {
  const { member: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  // Form State
  const [form, setForm] = useState(() => buildInitialForm(mode, member, preset));
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [saving, setSaving] = useState(false);

  // Photo / Cropper State
  const [photoFile, setPhotoFile] = useState(null); // The final optimized file
  const [imageSrc, setImageSrc] = useState(null); // Raw image preview URL for cropper
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileInputRef = useRef(null);

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
    setForm(buildInitialForm(mode, member, preset));
    setPhotoFile(null);
    setImageSrc(null);
    setIsCropping(false);
    setFieldErrors({});
    setApiError(null);
    setConflict(null);
  }, [mode, member, preset]);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  }, [imageSrc]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((e) => ({ ...e, [k]: null }));
  }

  function validate() {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Name is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Enter a valid email address.';
    }
    return errors;
  }

  // --- File Selection & Cropping Logic ---
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setIsCropping(true); // Switch modal view to cropper
      // Reset input value so selecting the same file again works
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      // Convert blob back to a File object for the API
      const optimizedFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
      setPhotoFile(optimizedFile);
      setIsCropping(false);
    } catch (e) {
      console.error(e);
      setApiError('Failed to crop image. Please try another photo.');
      setIsCropping(false);
    }
  };

  const handleCropCancel = () => {
    setImageSrc(null);
    setIsCropping(false);
  };
  // ---------------------------------------

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setApiError(null);
    setConflict(null);

    const body = {
      name: form.name.trim(),
      dob: form.dob || null,
      anniversary: form.anniversary || null,
      mobile: form.mobile || null,
      email: form.email || null,
      location: form.location || null,
      photo: form.photoUrl || null,
      gender: form.gender || null,
    };

    if (isAdmin) {
      body.father_id = form.fatherId ?? null;
      body.mother_id = form.motherId ?? null;
      body.spouse_id = form.spouseId ?? null;
      body.late = form.isDeceased ? 'x' : '';
    }

    try {
      let result;
      if (mode === 'create') {
        result = await api.createMember(currentUser.fid, body);
        if (photoFile) {
          result = await api.uploadPhoto(currentUser.fid, result.member.mid, photoFile);
        }
      } else {
        result = await api.updateMember(currentUser.fid, member.mid, body);
        if (photoFile) {
          result = await api.uploadPhoto(currentUser.fid, member.mid, photoFile);
        }
      }
      onSuccess(result.member);
      bsModal.current?.hide();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const existing = err.data?.existing;
        setConflict({ message: err.message, mid: existing?.mid ?? null });
      } else {
        setApiError(err.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Add family member' : 'Edit profile';
  const submitLabel = mode === 'create' ? 'Add member' : 'Save changes';

  // Render the cropper interface if we are in cropping mode
  if (isCropping) {
    return (
      <div ref={modalRef} className="modal fade" tabIndex="-1" aria-modal="true" role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-medium">Adjust Profile Photo</h5>
              <button type="button" className="btn-close" onClick={handleCropCancel} aria-label="Close" />
            </div>
            <div className="modal-body p-0 position-relative" style={{ height: '400px', backgroundColor: '#333' }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="modal-footer d-flex justify-content-between">
              <input
                type="range"
                className="form-range w-50"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(e.target.value)}
              />
              <div>
                <button type="button" className="btn btn-secondary btn-sm me-2" onClick={handleCropCancel}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleCropConfirm}>
                  Apply Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render the standard form
  return (
    <div ref={modalRef} className="modal fade" tabIndex="-1" aria-modal="true" role="dialog">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <form className="modal-content" onSubmit={handleSubmit} noValidate>
          <div className="modal-header">
            <h5 className="modal-title fw-medium">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>

          <div className="modal-body">

              <div className="mb-3">
                <label className="form-label small fw-medium">
                  Full name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className={`form-control ${fieldErrors.name ? 'is-invalid' : ''}`}
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. Kavya Vardhan"
                />
                {fieldErrors.name && (
                  <div className="invalid-feedback">{fieldErrors.name}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Gender</label>
                <div className="d-flex gap-3 flex-wrap">
                  {[['M', 'Male'], ['F', 'Female'], ['', 'Prefer not to say']].map(([val, lbl]) => (
                    <div key={val || 'none'} className="form-check">
                      <input
                        type="radio"
                        className="form-check-input"
                        id={`gender-${val || 'none'}`}
                        name="gender"
                        value={val}
                        checked={form.gender === val}
                        onChange={() => setField('gender', val)}
                      />
                      <label className="form-check-label small" htmlFor={`gender-${val || 'none'}`}>
                        {lbl}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Date of birth</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.dob}
                  onChange={(e) => setField('dob', e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Wedding anniversary</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.anniversary}
                  onChange={(e) => setField('anniversary', e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Mobile</label>
                <input
                  type="tel"
                  className="form-control"
                  value={form.mobile}
                  onChange={(e) => setField('mobile', e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Email</label>
                <input
                  type="email"
                  className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="example@email.com"
                />
                {fieldErrors.email && (
                  <div className="invalid-feedback">{fieldErrors.email}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Location</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.location}
                  onChange={(e) => setField('location', e.target.value)}
                  placeholder="City or region"
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Profile Photo</label>
                <div className="d-flex align-items-center gap-3">
                  {/* Tiny preview of the selected/cropped file */}
                  {photoFile && (
                    <img 
                      src={URL.createObjectURL(photoFile)} 
                      alt="Preview" 
                      className="rounded-circle border" 
                      style={{ width: '48px', height: '48px', objectFit: 'cover' }} 
                    />
                  )}
                  <div className="flex-grow-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="form-control"
                      onChange={handleFileChange}
                    />
                    {(form.photoUrl || photoFile) && (
                      <div className="form-text small">
                        {photoFile ? "New photo ready to upload." : "Leave empty to keep the current photo."}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <>
                  <hr className="my-3" />

                  <div className="mb-3">
                    <label className="form-label small fw-medium">Father</label>
                    <MemberPicker
                      value={form.fatherId}
                      onChange={(v) => setField('fatherId', v)}
                      placeholder="Search for father..."
                      excludeMids={member?.mid != null ? [member.mid] : []}
                      familyMembers={familyMembers}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-medium">Mother</label>
                    <MemberPicker
                      value={form.motherId}
                      onChange={(v) => setField('motherId', v)}
                      placeholder="Search for mother..."
                      excludeMids={member?.mid != null ? [member.mid] : []}
                      familyMembers={familyMembers}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-medium">Spouse</label>
                    <MemberPicker
                      value={form.spouseId}
                      onChange={(v) => setField('spouseId', v)}
                      placeholder="Search for spouse..."
                      excludeMids={member?.mid != null ? [member.mid] : []}
                      familyMembers={familyMembers}
                    />
                  </div>

                  <div className="mb-3 form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="edit-isDeceased"
                      checked={form.isDeceased}
                      onChange={(e) => setField('isDeceased', e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="edit-isDeceased">
                      In memoriam — this member has passed
                    </label>
                  </div>
                </>
              )}

              {apiError && (
                <div className="alert alert-danger small py-2 mb-3">{apiError}</div>
              )}

              {conflict && (
                <div className="alert alert-warning small py-2 mb-3">
                  {conflict.message}
                  {conflict.mid != null && (
                    <>
                      {' '}
                      <Link
                        to={`/${currentUser.fid}/${conflict.mid}`}
                        className="alert-link"
                        onClick={onClose}
                      >
                        View their profile
                      </Link>
                    </>
                  )}
                </div>
              )}

          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              {saving && (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />
              )}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}