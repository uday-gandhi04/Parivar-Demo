import { useEffect, useRef, useState } from 'react';
import { MemberAvatar } from './MemberAvatar.jsx';

function HopArrow({ hopLabel }) {
  return (
    <div className="relation-hop-arrow">
      <div className="relation-hop-hi">{hopLabel.hi}</div>
      <div className="relation-hop-line">
        <span className="relation-hop-rule" />
        <span className="relation-hop-chevron">›</span>
      </div>
      <div className="relation-hop-en">{hopLabel.en}</div>
    </div>
  );
}

function MemberBubble({ member, highlight }) {
  return (
    <div className="relation-chain-bubble">
      <MemberAvatar member={member} size={highlight ? 'lg' : 'md'} highlight={highlight} />
      <div className="relation-chain-name">{member?.name ?? '?'}</div>
    </div>
  );
}

export function RelationPathModal({ isOpen, onClose, focusMember, targetMember, relationPath }) {
  const hasAnimated = useRef(false);
  const totalSteps = relationPath ? relationPath.hops.length + 1 : 0;
  const [revealedCount, setRevealedCount] = useState(0);
  const [pulse, setPulse] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Staggered animation
  useEffect(() => {
    if (!isOpen || totalSteps === 0) return;

    if (hasAnimated.current) {
      setRevealedCount(totalSteps);
      setPulse(false);
      return;
    }

    hasAnimated.current = true;
    setRevealedCount(0);
    setPulse(false);

    const timers = [];
    timers.push(setTimeout(() => setRevealedCount(1), 50));
    for (let i = 2; i <= totalSteps; i++) {
      timers.push(setTimeout(() => setRevealedCount(i), 50 + (i - 1) * 350));
    }
    timers.push(setTimeout(() => setPulse(true), 50 + totalSteps * 350 + 200));

    return () => timers.forEach(clearTimeout);
  }, [isOpen, totalSteps]);

  if (!relationPath || !isOpen) return null;

  const { relation, hops } = relationPath;

  return (
    <>
      {/* Backdrop */}
      <div
        className="relation-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relation-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="How are you related?"
      >
        <div className="relation-modal-content">

          <div className="relation-modal-header">
            <div>
              <div className="fw-semibold" style={{ fontSize: '1.1rem' }}>How are you related?</div>
              <div className="small text-body-secondary mt-1">
                {focusMember?.name} → {targetMember?.name}
              </div>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            />
          </div>

          <div className="relation-modal-body">
            {relation && (
              <div className={`relation-label-header text-center mb-4${pulse ? ' relation-label-pulse' : ''}`}>
                <div className="fw-bold fs-5" style={{ color: 'var(--parivar-accent)' }}>
                  {relation.hi}
                </div>
                <div className="small text-body-secondary">{relation.en}</div>
              </div>
            )}

            <div className="relation-chain">
              <div className={`relation-chain-step${revealedCount >= 1 ? ' revealed' : ''}`}>
                <MemberBubble member={focusMember} highlight={false} />
              </div>

              {hops.map((hop, i) => (
                <div
                  key={i}
                  className={`relation-chain-step${revealedCount >= i + 2 ? ' revealed' : ''}`}
                >
                  <HopArrow hopLabel={hop.hopLabel} />
                  <MemberBubble
                    member={hop.toMember}
                    highlight={i === hops.length - 1}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="relation-modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
