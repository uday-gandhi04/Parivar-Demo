import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { IconUserPlus } from '@tabler/icons-react'; // Removed IconUsersGroup
import { ThemeToggle } from './ThemeToggle.jsx';
import { EditMemberModal } from './EditMemberModal.jsx';
import { MemberAvatar } from './MemberAvatar.jsx';
import { useAuth } from '../lib/auth.jsx';
import { canCreate } from '../lib/permissions.js';
import { listAllMembers, bustCache } from '../lib/memberCache.js';

// Import the actual logo
import parivarLogo from '../asset/Parivar_icon.png';

const LAYOUT_TABS = [
  { to: 'directory', label: 'Directory' },
  { to: 'graph', label: 'Graph' },
  { to: 'explore', label: 'Explore' },
  { to: '/about', label: 'About the demo', absolute: true },
  { to: '/contributors', label: 'Contributors', absolute: true },
];

function UserWidget() {
  const { member, logout } = useAuth();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [addMembers, setAddMembers] = useState([]);

  if (!member) return null;

  const fid = member.fid;
  const firstName = member.name?.split(/\s+/)[0] ?? 'Me';
  const userCanCreate = canCreate(member);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function openAdd() {
    setAddOpen(true);
    if (addMembers.length === 0) {
      listAllMembers(fid).then(setAddMembers).catch(() => {});
    }
  }

  function handleCreateSuccess(savedMember) {
    bustCache(fid);
    setAddOpen(false);
    navigate(`/${savedMember.mid}`);
  }

  return (
    <>
      <div className="dropdown ms-2">
        <button
          type="button"
          className="btn btn-sm d-flex align-items-center gap-2 p-0 border-0 bg-transparent text-body"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          <div style={{ transform: 'scale(0.85)', transformOrigin: 'center right' }}>
            <MemberAvatar member={member} size="sm" />
          </div>
          <span className="small fw-medium d-none d-sm-inline">{firstName}</span>
        </button>
        <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0">
          <li>
            <span className="dropdown-item-text small text-body-secondary">{member.email ?? member.name}</span>
          </li>
          <li><hr className="dropdown-divider my-1" /></li>
          <li>
            <button
              type="button"
              className="dropdown-item small"
              onClick={() => navigate(`/${member.mid}`)}
            >
              Profile
            </button>
          </li>
          {userCanCreate && (
            <li>
              <button
                type="button"
                className="dropdown-item small d-flex align-items-center gap-2"
                onClick={openAdd}
              >
                <IconUserPlus size={14} /> Add member
              </button>
            </li>
          )}
          <li>
            <button type="button" className="dropdown-item small" onClick={handleLogout}>
              Logout
            </button>
          </li>
        </ul>
      </div>

      {userCanCreate && (
        <EditMemberModal
          mode="create"
          member={null}
          preset={null}
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSuccess={handleCreateSuccess}
          familyMembers={addMembers}
        />
      )}
    </>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const { member } = useAuth();
  const isDemo = member?.role === 'demo_viewer';
  const isGraph = pathname === '/graph' || pathname === '/explore';

  return (
    <div
      className="d-flex flex-column"
      style={isGraph ? { height: '100vh', overflow: 'hidden' } : { minHeight: '100vh' }}
    >
      <div className="container" style={{ maxWidth: '760px' }}>
        <header className="parivar-header d-flex align-items-center justify-content-between py-3">
          <Link
            to="/directory"
            className="d-flex align-items-center gap-2 text-decoration-none text-body"
          >
            {/* Replaced generic icon with the actual logo image */}
            <img 
              src={parivarLogo} 
              alt="Parivar Logo" 
              style={{ width: 28, height: 28, objectFit: 'contain' }} 
            />
            <span className="fw-medium">Parivar</span>
          </Link>

          <div className="d-flex align-items-center">
            <ThemeToggle />
            <UserWidget />
          </div>
        </header>

        <nav className="d-flex align-items-center gap-1 py-2 small border-bottom" style={{ overflowX: 'auto' }}>
          <span className="text-body-secondary me-2 small d-none d-sm-inline">Layout</span>
          {LAYOUT_TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.absolute ? t.to : `/${t.to}`}
              end
              className={({ isActive }) =>
                `px-3 py-1 rounded text-decoration-none ${
                  isActive ? 'bg-body-tertiary fw-medium text-body' : 'text-body-secondary'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        {isDemo && (
          <div className="alert py-2 px-3 mt-2 mb-0 small d-flex flex-wrap align-items-center justify-content-between gap-2" style={{ background: 'var(--parivar-accent-bg)', border: '1px solid var(--bs-border-color)', color: 'var(--parivar-accent-text)' }}>
            <span><strong>DEMO MODE</strong> · Fictional family · Read-only access</span>
            <span className="opacity-75">Changes and uploads are disabled</span>
          </div>
        )}
      </div>

      <main
        className={isGraph ? 'flex-grow-1 d-flex flex-column overflow-hidden' : 'container py-3'}
        style={isGraph ? {} : { maxWidth: '760px' }}
      >
        <Outlet />
      </main>
    </div>
  );
}