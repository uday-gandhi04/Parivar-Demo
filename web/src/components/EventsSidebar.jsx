import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconGift, IconGlassFull, IconCalendarEvent, IconX } from '@tabler/icons-react';
import { getFamilyEvents } from '../lib/events.js';

function computeLocalBfs(allMembers, startMid) {
  const distances = new Map([[startMid, 0]]);
  const queue = [startMid];
  const adj = new Map(allMembers.map((m) => [m.mid, new Set()]));
  for (const member of allMembers) {
    for (const target of [member.fatherId, member.motherId, member.spouseId]) {
      if (target == null) continue;
      adj.get(member.mid)?.add(target);
      adj.get(target)?.add(member.mid);
    }
  }
  while (queue.length) {
    const current = queue.shift();
    for (const next of adj.get(current) || []) {
      if (!distances.has(next)) {
        distances.set(next, distances.get(current) + 1);
        queue.push(next);
      }
    }
  }
  return distances;
}

export function EventsSidebar({ isOpen, onClose, members, currentMemberMid }) {
  const navigate = useNavigate();
  const { todaysEvents, upcomingEvents } = useMemo(() => getFamilyEvents(members), [members]);
  const localDistances = useMemo(() => {
    if (!isOpen || !members.length || !currentMemberMid) return new Map();
    return computeLocalBfs(members, currentMemberMid);
  }, [isOpen, members, currentMemberMid]);

  const handleCardClick = (event) => {
    onClose();
    if (event.type === 'Birthday' || !event.member.spouseId) {
      navigate(`/${event.member.mid}`);
      return;
    }
    const a = event.member.mid;
    const b = event.member.spouseId;
    navigate((localDistances.get(b) ?? 999) < (localDistances.get(a) ?? 999) ? `/${b}` : `/${a}`);
  };

  const EventCard = ({ event, isToday }) => (
    <button
      type="button"
      onClick={() => handleCardClick(event)}
      className="w-100 text-start d-flex align-items-center gap-3 p-3 mb-2 rounded event-interactive-card"
      style={{ border: isToday ? '1px solid var(--parivar-accent)' : '1px solid var(--bs-border-color)', background: isToday ? 'var(--parivar-accent-bg)' : 'transparent', color: 'var(--bs-body-color)' }}
    >
      <span className="d-flex flex-column align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: 46, height: 46, background: 'var(--parivar-accent-bg)', color: 'var(--parivar-accent-text)' }}>
        <strong style={{ fontSize: '1.1rem', lineHeight: 1 }}>{event.date.getDate()}</strong>
        <small className="text-uppercase">{event.date.toLocaleDateString('en-US', { month: 'short' })}</small>
      </span>
      <span className="flex-grow-1 min-w-0">
        <span className="d-flex align-items-center gap-1 mb-1 small text-uppercase fw-semibold" style={{ color: 'var(--parivar-accent)' }}>
          {event.type === 'Birthday' ? <IconGift size={12} /> : <IconGlassFull size={12} />} {event.type}
        </span>
        <span className="d-block fw-medium text-truncate">{event.title || event.member.name}</span>
        <span className="d-block small text-body-secondary mt-1">{event.type === 'Birthday' ? `Turning ${event.age}` : `${event.age}th Anniversary`}</span>
      </span>
    </button>
  );

  return (
    <>
      {isOpen && <div className="offcanvas-backdrop fade show" style={{ zIndex: 1040 }} onClick={onClose} />}
      <aside className={`offcanvas offcanvas-end ${isOpen ? 'show' : ''}`} style={{ zIndex: 1045, visibility: isOpen ? 'visible' : 'hidden', width: 340, background: 'var(--bs-body-bg)', color: 'var(--bs-body-color)', borderLeft: '1px solid var(--bs-border-color)' }} tabIndex={-1} aria-label="Family events">
        <div className="offcanvas-header border-bottom">
          <div className="d-flex align-items-center gap-2"><IconCalendarEvent size={18} style={{ color: 'var(--parivar-accent)' }} /><h2 className="offcanvas-title fw-bold fs-6 mb-0">Family Events</h2></div>
          <button type="button" className="btn p-0 border-0 bg-transparent text-body" onClick={onClose} aria-label="Close events"><IconX size={20} /></button>
        </div>
        <div className="px-3 pt-3"><span className="badge rounded-pill text-bg-secondary">Demo data · Notifications disabled</span></div>
        <div className="offcanvas-body p-3 overflow-auto">
          {todaysEvents.length === 0 && upcomingEvents.length === 0 && <div className="text-center mt-5 py-5 text-body-secondary"><IconCalendarEvent size={48} className="mb-3" /><p>No upcoming events in the next 30 days.</p></div>}
          {todaysEvents.length > 0 && <section className="mb-4"><h3 className="h6 fw-bold mb-3">Today 🎉</h3>{todaysEvents.map((event, idx) => <EventCard key={`today-${idx}`} event={event} isToday />)}</section>}
          {upcomingEvents.length > 0 && <section><h3 className="small fw-semibold mb-3 mt-2 text-uppercase text-body-secondary">Next 30 Days</h3>{upcomingEvents.map((event, idx) => <EventCard key={`upcoming-${idx}`} event={event} isToday={false} />)}</section>}
        </div>
      </aside>
    </>
  );
}
