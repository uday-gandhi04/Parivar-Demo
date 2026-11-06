const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'parivar:token';

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new CustomEvent('parivar:unauthorized'));
  }
  if (!res.ok) {
    let data = null;
    let message = `${res.status} ${res.statusText}`;
    try {
      data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* response was not JSON */ }
    throw new ApiError(message, res.status, data);
  }
  return res.json();
}

const get = (path) => request(path);
const post = (path, body = {}) => request(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  health: () => get('/api/health'),
  demoSession: () => post('/api/auth/demo-session'),
  me: () => get('/api/auth/me'),
  listFamilies: () => get('/api/families'),
  getFamily: (fid) => get(`/api/families/${encodeURIComponent(fid)}`),
  listMembers: (fid, opts = {}) => {
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts.skip !== undefined) params.set('skip', String(opts.skip));
    const qs = params.toString();
    return get(`/api/families/${encodeURIComponent(fid)}/members${qs ? `?${qs}` : ''}`);
  },
  getMember: (fid, mid) => get(`/api/families/${encodeURIComponent(fid)}/members/${mid}`),
  getTree: (fid, mid, degrees = 2) => get(`/api/families/${encodeURIComponent(fid)}/members/${mid}/tree?degrees=${degrees}`),
};
