import { api } from './api.js';

// Session-scoped promise cache keyed by fid.
// Storing the Promise (not the resolved value) means concurrent callers
// during the first fetch all await the same request rather than firing duplicates.
const cache = new Map();

export function listAllMembers(fid) {
  if (!cache.has(fid)) {
    cache.set(
      fid,
      api.listMembers(fid, { limit: 1000 }).then((r) => r.members ?? [])
    );
  }
  return cache.get(fid);
}

export function bustCache(fid) {
  cache.delete(fid);
}
