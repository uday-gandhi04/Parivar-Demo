// Fields a regular member can update on their own record
export const SELF_EDITABLE = ['name', 'dob', 'anniversary', 'mobile', 'email', 'location', 'photoUrl'];

// Fields an admin-or-higher can additionally update
export const ADMIN_EDITABLE = [
  ...SELF_EDITABLE,
  'fatherId', 'motherId', 'spouseId', 'gender', 'isDeceased',
];

/**
 * Returns true if actor is allowed to perform action on target.
 * @param {{ mid: number, fid: string, role: string|null }} actor - req.user
 * @param {'create'|'update'|'delete'|'set_role'} action
 * @param {{ mid: number, fid: string }|null} target - the member being acted on
 */
export function permissionOk(actor, action, target = null) {
  // Cross-family operations are never allowed
  if (target && target.fid !== actor.fid) return false;

  if (actor.role === 'super_admin') return true;

  if (actor.role === 'admin') {
    return action === 'create' || action === 'update';
  }

  // Regular member: can only update their own record
  if (action === 'update' && target && actor.mid === target.mid) return true;

  return false;
}

/**
 * Returns the list of camelCase field names this actor may write for target.
 */
export function getAllowedFields(actor, target = null) {
  if (actor.role === 'super_admin' || actor.role === 'admin') return ADMIN_EDITABLE;
  if (target && actor.mid === target.mid) return SELF_EDITABLE;
  return [];
}
