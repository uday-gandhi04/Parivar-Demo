import { useState, useRef, useEffect } from 'react';
import { IconX } from '@tabler/icons-react';

export function MemberPicker({
  value,
  onChange,
  placeholder = 'Search by name...',
  excludeMids = [],
  familyMembers = [],
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const containerRef = useRef(null);

  const selectedMember = value != null
    ? (familyMembers.find((m) => m.mid === value) ?? null)
    : null;

  const options = text.length > 0
    ? familyMembers
        .filter((m) => !excludeMids.includes(m.mid) && m.name.toLowerCase().includes(text.toLowerCase()))
        .slice(0, 10)
    : [];

  useEffect(() => {
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  function selectMember(m) {
    onChange(m.mid);
    setText('');
    setOpen(false);
    setHighlightedIdx(-1);
  }

  function clearSelection() {
    onChange(null);
    setText('');
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' && options.length > 0) {
        setOpen(true);
        setHighlightedIdx(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      setHighlightedIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      setHighlightedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIdx >= 0 && options[highlightedIdx]) {
        selectMember(options[highlightedIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  if (selectedMember) {
    return (
      <div className="form-control d-flex align-items-center" style={{ cursor: 'default', minHeight: 38 }}>
        <span className="flex-grow-1 small">{selectedMember.name}</span>
        <button
          type="button"
          className="btn btn-sm p-0 border-0 bg-transparent text-body-secondary ms-2"
          onClick={clearSelection}
          aria-label="Clear selection"
        >
          <IconX size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="position-relative">
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setHighlightedIdx(-1);
        }}
        onFocus={() => { if (text) setOpen(true); }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && text && (
        <ul
          className="dropdown-menu show w-100 py-1"
          style={{ maxHeight: 240, overflowY: 'auto', zIndex: 1060 }}
        >
          {options.length > 0
            ? options.map((m, i) => (
                <li key={m.mid}>
                  <button
                    type="button"
                    className={`dropdown-item small py-1 ${i === highlightedIdx ? 'active' : ''}`}
                    onPointerDown={(e) => { e.preventDefault(); selectMember(m); }}
                  >
                    <span className="fw-medium">{m.name}</span>
                    {m.location && (
                      <span className="ms-1 opacity-75">· {m.location}</span>
                    )}
                  </button>
                </li>
              ))
            : (
              <li>
                <span className="dropdown-item-text small text-body-secondary">No members match</span>
              </li>
            )}
        </ul>
      )}
    </div>
  );
}
