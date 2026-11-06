import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconAlertCircle, IconUserPlus, IconCalendarEvent } from '@tabler/icons-react';
import { api } from '../lib/api.js';
import { bustCache } from '../lib/memberCache.js';
import { useAuth } from '../lib/auth.jsx';
import { canCreate } from '../lib/permissions.js';
import { MemberCard } from '../components/MemberCard.jsx';
import { EditMemberModal } from '../components/EditMemberModal.jsx';
import { EventsSidebar } from '../components/EventsSidebar.jsx';
import { buildRelationMap } from '../lib/relations.js';

export function DirectoryPage() {
  const navigate = useNavigate();
  const { member: currentUser } = useAuth();
  const fid = currentUser.fid;

  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

  function loadMembers() {
    setLoading(true);
    setError(null);
    api
      .listMembers(fid, { limit: 2000 })
      .then((res) => {
        setMembers(res.members);
        setTotal(res.total);
      })
      .catch((err) => {
        setError(err.message ?? 'Failed to load members');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMembers();
  }, [fid]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedMembers = useMemo(() => {
  if (!members.length || !currentUser?.mid) return members;

  // -------------------------------
  // Build adjacency list
  // -------------------------------
  const graph = new Map();

  members.forEach((m) => {
    graph.set(m.mid, []);
  });

  members.forEach((m) => {
    const addEdge = (a, b) => {
      if (!a || !b) return;
      graph.get(a)?.push(b);
      graph.get(b)?.push(a);
    };

    addEdge(m.mid, m.fatherId);
    addEdge(m.mid, m.motherId);
    addEdge(m.mid, m.spouseId);
  });

  // -------------------------------
  // BFS
  // -------------------------------
  const distance = new Map();

  const queue = [currentUser.mid];

  distance.set(currentUser.mid, 0);

  while (queue.length) {
    const current = queue.shift();

    const neighbours = graph.get(current) || [];

    for (const next of neighbours) {
      if (!distance.has(next)) {
        distance.set(next, distance.get(current) + 1);
        queue.push(next);
      }
    }
  }

  // -------------------------------
  // Relation priority
  // -------------------------------

  const relationPriority = (member) => {

    if (member.mid === currentUser.mid) return 0;

    const isParent =
      member.mid === currentUser.fatherId ||
      member.mid === currentUser.motherId;

    if (isParent) return 1;

    const isChild =
      member.fatherId === currentUser.mid ||
      member.motherId === currentUser.mid;

    if (isChild) return 2;

    const isSpouse =
      member.mid === currentUser.spouseId;

    if (isSpouse) return 3;

    const isSibling =
      (
        member.fatherId &&
        member.fatherId === currentUser.fatherId
      ) ||
      (
        member.motherId &&
        member.motherId === currentUser.motherId
      );

    if (isSibling) return 4;

    return 10;
  };

  return [...members].sort((a, b) => {

    const dA = distance.get(a.mid) ?? Infinity;
    const dB = distance.get(b.mid) ?? Infinity;

    // Hop count first
    if (dA !== dB) return dA - dB;

    // Within same hop count
    const pA = relationPriority(a);
    const pB = relationPriority(b);

    if (pA !== pB) return pA - pB;

    return a.name.localeCompare(b.name);

  });

}, [members, currentUser]);

  // Filter the ALREADY SORTED members based on the search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.location ?? '').toLowerCase().includes(q)
    );
  }, [sortedMembers, query]);

  function handleCreateSuccess(savedMember) {
    bustCache(fid);
    setAddOpen(false);
    navigate(`/${savedMember.mid}`);
  }

  const userCanCreate = canCreate(currentUser);

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <div className="input-group flex-grow-1">
          <span className="input-group-text bg-body">
            <IconSearch size={16} className="text-body-secondary" />
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Search by name or city..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="input-group-text bg-body small text-body-secondary">
            {filtered.length} of {total}
          </span>
        </div>

        {/* Events Toggle Button */}
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 text-nowrap"
          onClick={() => setShowEvents(true)}
        >
          <IconCalendarEvent size={15} /> 
          <span className="d-none d-sm-inline">Events</span>
        </button>

        {userCanCreate && (
          <button
            type="button"
            className="btn btn-sm btn-primary d-flex align-items-center gap-1 text-nowrap"
            onClick={() => setAddOpen(true)}
          >
            <IconUserPlus size={15} /> 
            <span className="d-none d-sm-inline">Add member</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="py-5 text-center small text-body-secondary">Loading family...</div>
      )}

      {error && (
        <div className="d-flex align-items-start gap-3 p-3 border rounded bg-body-secondary">
          <IconAlertCircle size={18} className="text-primary flex-shrink-0 mt-1" />
          <div>
            <div className="fw-medium">Couldn't load members</div>
            <div className="small text-body-secondary mt-1">{error}</div>
            <div className="small text-body-tertiary mt-2">
              Is the API server running?
            </div>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="py-5 text-center small text-body-secondary">
          {query ? `No matches for "${query}"` : 'No members in this family yet'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="row row-cols-1 row-cols-sm-2 g-2">
          {filtered.map((m) => (
            <div className="col" key={m.mid}>
              <MemberCard member={m} />
            </div>
          ))}
        </div>
      )}

      <EditMemberModal
        mode="create"
        member={null}
        preset={null}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={handleCreateSuccess}
        familyMembers={members}
      />

      {/* Events Sidebar Overlay */}
      <EventsSidebar
        isOpen={showEvents}
        onClose={() => setShowEvents(false)}
        members={members}
      />
    </div>
  );
}