export function canEdit(currentUser, targetMember) {
  if (!currentUser || !targetMember || currentUser.role === 'demo_viewer') return false;
  if (currentUser.fid !== targetMember.fid) return false;
  if (currentUser.role === 'super_admin' || currentUser.role === 'admin') return true;
  return currentUser.mid === targetMember.mid;
}

export function canCreate(currentUser) {
  if (!currentUser || currentUser.role === 'demo_viewer') return false;
  return currentUser.role === 'super_admin' || currentUser.role === 'admin';
}

export function canDelete(currentUser, targetMember = null) {
  if (!currentUser || currentUser.role === 'demo_viewer') return false;
  if (targetMember && currentUser.fid !== targetMember.fid) return false;
  return currentUser.role === 'super_admin';
}

export function canSetRole(currentUser, targetMember) {
  if (!currentUser || !targetMember || currentUser.role === 'demo_viewer') return false;
  if (currentUser.fid !== targetMember.fid) return false;
  return currentUser.role === 'super_admin';
}
