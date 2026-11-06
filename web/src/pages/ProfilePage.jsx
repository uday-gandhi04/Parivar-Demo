import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import {
  IconArrowLeft, IconCake, IconHeart, IconMapPin, IconPhone,
  IconEdit, IconUserPlus, IconTrash,
} from '@tabler/icons-react';
import { api } from '../lib/api.js';
import { listAllMembers, bustCache } from '../lib/memberCache.js';
import { useAuth } from '../lib/auth.jsx';
import { canEdit, canCreate, canDelete } from '../lib/permissions.js';
import { buildRelationMap, classifyTier, TIER_ORDER, TIER_LABELS, getRelation, getRelationPath } from '../lib/relations.js';
import { MemberAvatar } from '../components/MemberAvatar.jsx';
import { MemberCard } from '../components/MemberCard.jsx';
import { RelationPathModal } from '../components/RelationPathModal.jsx';
import { EditMemberModal } from '../components/EditMemberModal.jsx';
import { DeleteMemberDialog } from '../components/DeleteMemberDialog.jsx';
import { RoleAssignmentControl } from '../components/RoleAssignmentControl.jsx';
import { CareerSection } from '../components/CareerSection.jsx';
import { EducationSection } from '../components/EducationSection.jsx';
import { PhotoViewerModal } from '../components/PhotoViewerModal.jsx';
import { getConciseRelation } from '../lib/relationHelper';

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return null;
  }
}


export function ProfilePage() {
  const { mid } = useParams();
  const navigate = useNavigate();
  const { member: currentUser, refreshMember } = useAuth();
  const fid = currentUser.fid;

  const [data, setData] = useState(null);
  const [treeMembers, setTreeMembers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isPathOpen, setIsPathOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'edit' | 'create' | 'delete'
  const [createPreset, setCreatePreset] = useState(null);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);


  const loadProfile = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getMember(fid, Number(mid)),
      api.getTree(fid, Number(mid), 5),
      listAllMembers(fid),
    ])
      .then(([memberRes, treeRes, all]) => {
        if (cancelled) return;
        setData(memberRes);
        setTreeMembers(treeRes.members ?? []);
        setAllMembers(all);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fid, mid]);

  useEffect(() => {
    return loadProfile();
  }, [loadProfile]);

  // Derive viewer mid from auth
  const viewerMid = currentUser?.mid ?? null;

  const focusMidEarly = data?.member?.mid ?? null;
  const isSelfEarly = focusMidEarly === viewerMid;

  const relationPath = useMemo(
    () => (!isSelfEarly && focusMidEarly != null && allMembers.length > 0
      ? getRelationPath(viewerMid, focusMidEarly, allMembers)
      : null),
    [isSelfEarly, focusMidEarly, viewerMid, allMembers],
  );

  const viewerMember = useMemo(
    () => allMembers.find((m) => m.mid === viewerMid) ?? null,
    [allMembers, viewerMid],
  );

  if (!mid || isNaN(Number(mid)) || !Number.isInteger(Number(mid)) || Number(mid) <= 0) {
    return <Navigate to="/directory" replace />;
  }

  if (loading) {
    return <div className="py-5 text-center small text-body-secondary">Loading profile...</div>;
  }
  if (error) {
    return (
      <div className="p-3 border rounded bg-body-secondary">
        <div className="fw-medium">Couldn't load profile</div>
        <div className="small text-body-secondary mt-1">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  const { member, relations, businesses = [], educations = [] } = data;
  const focusMid = member.mid;
  const dob = formatDate(member.dob);
  const anniversary = formatDate(member.anniversary);

  const relMap = treeMembers.length > 0
    ? buildRelationMap(focusMid, treeMembers, allMembers.length > 0 ? allMembers : null)
    : new Map();

  function formatLabel(labelObj, targetMember, perspectiveMember) {
    if (!labelObj || !labelObj.hi) return labelObj;
    return {
      ...labelObj,
      hi: getConciseRelation(labelObj.hi, targetMember, perspectiveMember, allMembers)
    };
  }

  function relLabel(m) {
    const baseLabel = relMap.get(m.mid)?.label ?? null;
    return formatLabel(baseLabel, m, member);
  }

  const directMids = new Set([
    relations.father?.mid,
    relations.mother?.mid,
    relations.spouse?.mid,
    ...relations.children.map((c) => c.mid),
  ].filter(Boolean));

  const siblings = treeMembers.filter((m) => {
    if (m.mid === focusMid) return false;
    if (directMids.has(m.mid)) return false;
    const path = relMap.get(m.mid)?.path;
    return path?.length === 1 && path[0].startsWith('SIB:');
  });

  const familyMids = new Set([
    focusMid,
    ...directMids,
    ...siblings.map((s) => s.mid),
  ]);

  const extendedByTier = {};
  for (const m of treeMembers) {
    if (familyMids.has(m.mid)) continue;
    const entry = relMap.get(m.mid);
    if (!entry?.label) continue;
    const tier = classifyTier(entry.path);
    if (!extendedByTier[tier]) extendedByTier[tier] = [];
    extendedByTier[tier].push({ member: m, ...entry, label: formatLabel(entry.label, m, member) });
  }
  for (const arr of Object.values(extendedByTier)) {
    arr.sort((a, b) => a.path.length - b.path.length || a.member.name.localeCompare(b.member.name));
  }
  const hasExtended = Object.keys(extendedByTier).length > 0;

  const isSelf = focusMid === viewerMid;
  const viewerRelation = !isSelf && allMembers.length > 0
    ? formatLabel(getRelation(viewerMid, focusMid, allMembers), member, viewerMember)
    : null;

  function spouseLabel(sp) {
    const base = relLabel(sp);
    if (!base) return anniversary ? `Spouse · since ${anniversary}` : 'Spouse';
    return anniversary
      ? { hi: base.hi, en: `${base.en} · since ${anniversary}` }
      : base;
  }

  // Permission checks
  const userCanEdit = canEdit(currentUser, member);
  const userCanCreate = canCreate(currentUser);
  const userCanDelete = canDelete(currentUser, member) && focusMid !== viewerMid;

  function handleEditSuccess(savedMember) {
    bustCache(fid);
    if (savedMember.mid === viewerMid) refreshMember();
    // Re-fetch to get full resolved relations
    setActiveModal(null);
    loadProfile();
  }

  function handleCreateSuccess(savedMember) {
    bustCache(fid);
    setActiveModal(null);
    navigate(`/${savedMember.mid}`);
  }

  function handleDeleteSuccess() {
    bustCache(fid);
    setActiveModal(null);
    navigate('/directory');
  }

  function handleRoleChange(updatedMember) {
    setData((prev) => prev ? { ...prev, member: updatedMember } : prev);
  }

  function openAddRelative() {
    setCreatePreset({ fatherId: focusMid });
    setActiveModal('create');
  }



  return (
    <div className="d-flex flex-column gap-4">
      <Link
        to="/directory"
        className="d-inline-flex align-items-center gap-1 small text-body-secondary text-decoration-none"
      >
        <IconArrowLeft size={14} /> Back to directory
      </Link>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="d-flex align-items-start gap-3">
        <MemberAvatar 
          member={data.member} 
          size="xl" 
          onClick={() => data.member?.photoUrl && setIsPhotoViewerOpen(true)} 
        />
        <div className="flex-grow-1 pt-1">
          <h1 className="h3 fw-medium mb-1">{member.name}</h1>

          {isSelf && (
            <p className="small text-body-secondary mb-1">This is your profile</p>
          )}
          {viewerRelation && (
            <div
              className="d-inline-flex align-items-center mb-1 px-2 rounded-pill small parivar-badge-clickable"
              style={{ background: 'var(--parivar-accent-bg)', color: 'var(--parivar-accent-text)' }}
              onClick={() => setIsPathOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setIsPathOpen(true)}
              title="See how you're related"
            >
              <span className="fw-medium">{viewerRelation.hi}</span>
              <span className="ms-1" style={{ opacity: 0.75 }}>· {viewerRelation.en}</span>
            </div>
          )}

          {member.isDeceased && (
            <span
              className="badge fw-normal"
              style={{ background: 'var(--parivar-deceased-bg)', color: 'var(--parivar-deceased)' }}
            >
              In memoriam
            </span>
          )}

          <div className="d-flex flex-wrap gap-3 small text-body-secondary mt-2">
            {dob && (
              <span className="d-inline-flex align-items-center gap-1">
                <IconCake size={14} /> {dob}
              </span>
            )}
            
            {anniversary && (
              <span className="d-inline-flex align-items-center gap-1">
                <IconHeart size={14} /> {anniversary}
              </span>
            )}
            
            {member.location && (
              <span className="d-inline-flex align-items-center gap-1">
                <IconMapPin size={14} /> {member.location}
              </span>
            )}
            
            {member.mobile && (
              <span className="d-inline-flex align-items-center gap-1">
                <IconPhone size={14} /> {member.mobile}
              </span>
            )}
          </div>

          {/* Action buttons */}
          {(userCanEdit || userCanCreate || userCanDelete) && (
            <div className="d-flex flex-wrap gap-2 mt-3 parivar-profile-actions">
              {userCanEdit && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                  onClick={() => setActiveModal('edit')}
                >
                  <IconEdit size={14} /> Edit profile
                </button>
              )}
              {userCanCreate && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                  onClick={openAddRelative}
                >
                  <IconUserPlus size={14} /> Add relative
                </button>
              )}
              {userCanDelete && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                  onClick={() => setActiveModal('delete')}
                >
                  <IconTrash size={14} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Family section ───────────────────────────────────────── */}
      <section>
        <div className="parivar-section-label">Family</div>
        <div className="row row-cols-1 row-cols-sm-2 g-2">
          {relations.father && (
            <div className="col">
              <MemberCard member={relations.father} label={relLabel(relations.father) ?? { hi: 'Pitaji', en: 'Father' }} />
            </div>
          )}
          {relations.mother && (
            <div className="col">
              <MemberCard member={relations.mother} label={relLabel(relations.mother) ?? { hi: 'Mataji', en: 'Mother' }} />
            </div>
          )}
          {relations.spouse && (
            <div className="col">
              <MemberCard member={relations.spouse} label={spouseLabel(relations.spouse)} />
            </div>
          )}
          {siblings.map((s) => (
            <div className="col" key={s.mid}>
              <MemberCard member={s} label={relLabel(s) ?? { hi: 'Bhai / Behen', en: 'Sibling' }} />
            </div>
          ))}
          {relations.children.map((c) => (
            <div className="col" key={c.mid}>
              <MemberCard member={c} label={relLabel(c) ?? { hi: 'Beta / Beti', en: 'Child' }} />
            </div>
          ))}
          {!relations.father &&
            !relations.mother &&
            !relations.spouse &&
            siblings.length === 0 &&
            relations.children.length === 0 && (
              <div className="col">
                <div className="small text-body-secondary">No direct family recorded yet.</div>
              </div>
            )}
        </div>
      </section>

      {/* ── Career section ───────────────────────────────────────── */}
      <CareerSection
        member={member}
        businesses={businesses}
        canEdit={userCanEdit}
        onChange={loadProfile}
      />

      {/* ── Education section ─────────────────────────────────────── */}
      <EducationSection
        member={member}
        educations={educations}
        canEdit={userCanEdit}
        onChange={loadProfile}
      />

      {/* ── Extended family section ──────────────────────────────── */}
      {hasExtended && (
        <section>
          <div className="parivar-section-label">Extended family</div>
          <div className="d-flex flex-column gap-3">
            {TIER_ORDER.filter((tier) => extendedByTier[tier]?.length).map((tier) => (
              <div key={tier}>
                <div className="small text-body-tertiary fw-medium mb-2">
                  {TIER_LABELS[tier] ?? 'Other relatives'}
                </div>
                <div className="row row-cols-1 row-cols-sm-2 g-2">
                  {extendedByTier[tier].map(({ member: m, label }) => (
                    <div className="col" key={m.mid}>
                      <MemberCard member={m} label={label} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Role control (super_admin only, not own profile) ─────── */}
      {!isSelf && (
        <RoleAssignmentControl member={member} onChange={handleRoleChange} />
      )}

      {/* ── Modals ───────────────────────────────────────────────── */}
      <EditMemberModal
        mode="edit"
        member={member}
        open={activeModal === 'edit'}
        onClose={() => setActiveModal(null)}
        onSuccess={handleEditSuccess}
        familyMembers={allMembers}
      />

      <EditMemberModal
        mode="create"
        member={null}
        preset={createPreset}
        open={activeModal === 'create'}
        onClose={() => setActiveModal(null)}
        onSuccess={handleCreateSuccess}
        familyMembers={allMembers}
      />

      <DeleteMemberDialog
        member={member}
        open={activeModal === 'delete'}
        onClose={() => setActiveModal(null)}
        onSuccess={handleDeleteSuccess}
      />

      {relationPath && (
        <RelationPathModal
          isOpen={isPathOpen}
          onClose={() => setIsPathOpen(false)}
          focusMember={viewerMember}
          targetMember={member}
          relationPath={relationPath}
        />
      )}

      <PhotoViewerModal 
        isOpen={isPhotoViewerOpen} 
        onClose={() => setIsPhotoViewerOpen(false)} 
        photoUrl={data.member?.photoUrl} 
        altText={data.member?.name}
      />
    </div>
  );
}