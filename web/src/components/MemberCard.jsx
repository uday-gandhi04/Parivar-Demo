import { Link } from 'react-router-dom';
import { MemberAvatar } from './MemberAvatar.jsx';

function formatLine(member) {
  const bits = [];
  if (member.isDeceased) bits.push('In memoriam');
  if (member.location) bits.push(member.location);
  return bits.join(' \u00b7 ');
}

export function MemberCard({ member, highlight = false, label }) {
  const isRelObj = label && typeof label === 'object' && label.hi;
  const strLabel = isRelObj ? null : (label ?? formatLine(member));

  return (
    <Link
      to={`/${member.mid}`}
      className={`parivar-row-card ${highlight ? 'highlight' : ''}`}
    >
      <MemberAvatar member={member} size="md" highlight={highlight} />
      <div className="flex-grow-1 text-truncate">
        <div
          className={`text-truncate small fw-medium ${
            member.isDeceased ? 'text-body-secondary' : ''
          }`}
        >
          {member.name}
        </div>
        {isRelObj && (
          <div className="text-truncate small text-body-secondary">
            <span className="fw-medium">{label.hi}</span>
            <span className="ms-1 opacity-75">· {label.en}</span>
          </div>
        )}
        {!isRelObj && strLabel && (
          <div className="text-truncate small text-body-secondary">{strLabel}</div>
        )}
      </div>
    </Link>
  );
}
