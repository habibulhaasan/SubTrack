'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const PATHS = {
  home:     'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  pay:      'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  ledger:   'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8',
  expenses: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  invest:   'M22 12h-4l-3 9L9 3l-3 9H2',
  profile:  'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  verify:   'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  members:  'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  bell:     'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  logout:   'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  summary:  'M18 20V10M12 20V4M6 20v-6',
  income:   'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  penalty:  'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  orgs:     'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chevron:  'M9 18l6-6-6-6',
  grid:     'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  heart:    'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  menu:     'M3 12h18M3 6h18M3 18h18',
  x:        'M18 6L6 18M6 6l12 12',
};

const PUBLIC = ['/', '/login', '/register', '/forgot-password', '/create-org', '/select-org', '/join', '/pending-approval'];

// NavItem is defined OUTSIDE Sidebar to prevent remount on every render
function NavItem({ label, path, icon, pathname, onClick }) {
  // Exact match for /admin, prefix match for all others
  const active = path === '/admin'
    ? pathname === '/admin'
    : (pathname === path || (path !== '/' && pathname.startsWith(path + '/')));

  return (
    <Link href={path} onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '8px',
        fontSize: '13px', fontWeight: active ? '600' : '400',
        color: active ? '#2563eb' : '#475569',
        background: active ? '#eff6ff' : 'transparent',
        textDecoration: 'none', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; } }}>
      <span style={{ color: active ? '#2563eb' : '#94a3b8', flexShrink: 0 }}>
        <Icon d={icon} size={15} />
      </span>
      {label}
    </Link>
  );
}

function SectionLabel({ label }) {
  return (
    <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '16px 12px 6px' }}>{label}</p>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const pathname = usePathname();
  const { user, userData, orgData, membership, isSuperAdmin, isOrgAdmin } = useAuth();

  const isPublic = PUBLIC.some(r => pathname === r || pathname.startsWith(r + '/'));

  useEffect(() => {
    if (!user || isPublic || !userData?.activeOrgId) return;
    const q = query(
      collection(db, 'organizations', userData.activeOrgId, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    return onSnapshot(q, snap => setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user, isPublic, userData?.activeOrgId]);

  if (isPublic || !user || !userData) return null;

  const unread = notifs.filter(n => !n.read).length;
  const initials = (userData?.nameEnglish || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const orgName = orgData?.name || 'My Organization';

  const markRead = () => {
    const orgId = userData?.activeOrgId;
    if (!orgId) return;
    notifs.filter(n => !n.read).forEach(n =>
      updateDoc(doc(db, 'organizations', orgId, 'notifications', n.id), { read: true }).catch(() => {})
    );
  };

  const toggleNotif = () => { setNotifOpen(v => !v); if (!notifOpen && unread > 0) markRead(); };
  const delNotif = (id) => {
    const orgId = userData?.activeOrgId;
    if (orgId) deleteDoc(doc(db, 'organizations', orgId, 'notifications', id)).catch(() => {});
  };
  const logout = async () => { await signOut(auth); window.location.href = '/login'; };
  const closeDrawer = () => setOpen(false);

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #e2e8f0' }}>
        <Link href={isSuperAdmin ? '/superadmin' : '/dashboard'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {orgData?.logoURL && !isSuperAdmin
              ? <img src={orgData.logoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <Icon d={PATHS.heart} size={18} />}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>DonateTrack</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{isSuperAdmin ? 'Super Admin' : orgName}</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {isSuperAdmin ? (
          <>
            <SectionLabel label="Platform" />
            <NavItem label="Overview"          path="/superadmin"            icon={PATHS.grid}     pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Organizations"     path="/superadmin/orgs"       icon={PATHS.orgs}     pathname={pathname} onClick={closeDrawer} />
            <NavItem label="All Members"       path="/superadmin/members"    icon={PATHS.members}  pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Admin Management"  path="/superadmin/admins"     icon={PATHS.shield}   pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Platform Settings" path="/superadmin/settings"   icon={PATHS.settings} pathname={pathname} onClick={closeDrawer} />
          </>
        ) : (
          <>
            {/* Org switcher */}
            <Link href="/select-org" onClick={closeDrawer}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', margin: '4px 0 8px', textDecoration: 'none', background: '#f8fafc', overflow: 'hidden' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Current Org</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orgName}</div>
              </div>
              <div style={{ flexShrink: 0, color: '#94a3b8' }}>
                <Icon d={PATHS.chevron} size={12} />
              </div>
            </Link>

            <SectionLabel label="Member" />
            <NavItem label="Dashboard"        path="/dashboard"   icon={PATHS.home}     pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Pay Installment"  path="/installment" icon={PATHS.pay}      pathname={pathname} onClick={closeDrawer} />
            <NavItem label="My Ledger"        path="/ledger"      icon={PATHS.ledger}   pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Expenses"         path="/expenses"    icon={PATHS.expenses} pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Projects"         path="/investments" icon={PATHS.invest}   pathname={pathname} onClick={closeDrawer} />
            <NavItem label="My Profile"       path="/profile"     icon={PATHS.profile}  pathname={pathname} onClick={closeDrawer} />

            {isOrgAdmin && (
              <>
                <SectionLabel label="Admin" />
                <NavItem label="Verify Payments"  path="/admin"                icon={PATHS.verify}   pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Investments"      path="/admin/investments"    icon={PATHS.invest}   pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Income"           path="/admin/income"         icon={PATHS.income}   pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Expenses"         path="/admin/expenses"       icon={PATHS.expenses} pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Penalties"        path="/admin/penalties"      icon={PATHS.penalty}  pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Member Ledger"    path="/admin/ledger"         icon={PATHS.ledger}   pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Summary"          path="/admin/summary"        icon={PATHS.summary}  pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Member List"      path="/admin/members"        icon={PATHS.members}  pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Notifications"    path="/admin/notifications"  icon={PATHS.bell}     pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Settings"         path="/admin/settings"       icon={PATHS.settings} pathname={pathname} onClick={closeDrawer} />
              </>
            )}
          </>
        )}
      </nav>

      {/* Notification bell (non-superadmin) */}
      {!isSuperAdmin && (
        <div style={{ padding: '0 8px', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={toggleNotif}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#475569', borderRadius: 8 }}>
            <div style={{ position: 'relative' }}>
              <Icon d={PATHS.bell} size={15} />
              {unread > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, background: '#dc2626', color: '#fff', fontSize: 8, fontWeight: 700, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>
              )}
            </div>
            <span>Notifications</span>
            {unread > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 99, fontWeight: 600 }}>{unread}</span>}
          </button>
        </div>
      )}

      {/* User footer */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {userData?.photoURL
              ? <img src={userData.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>{initials}</span>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userData?.nameEnglish?.split(' ')[0] || 'User'}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{isSuperAdmin ? 'superadmin' : (membership?.role || 'member')}</div>
          </div>
        </div>
        <button onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#94a3b8', width: '100%' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}>
          <Icon d={PATHS.logout} size={14} /><span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{ position: 'fixed', left: 0, top: 0, height: '100vh', width: 240, borderRight: '1px solid #e2e8f0', background: '#ffffff', zIndex: 50, display: 'none' }} className="md-sidebar">
        <style>{`.md-sidebar { display: block !important; } @media (max-width: 768px) { .md-sidebar { display: none !important; } }`}</style>
        {sidebarContent}
      </aside>

      {/* Mobile topbar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 60 }} className="mobile-bar">
        <style>{`.mobile-bar { display: none; } @media (max-width: 768px) { .mobile-bar { display: flex !important; } }`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {orgData?.logoURL && !isSuperAdmin
              ? <img src={orgData.logoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <Icon d={PATHS.heart} size={14} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {isSuperAdmin ? 'DonateTrack' : (orgData?.name || 'DonateTrack')}
            </div>
            {!isSuperAdmin && <div style={{ fontSize: 10, color: '#94a3b8' }}>DonateTrack</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isSuperAdmin && (
            <button onClick={toggleNotif} style={{ position: 'relative', padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
              <Icon d={PATHS.bell} size={18} />
              {unread > 0 && <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, background: '#dc2626', borderRadius: '50%' }} />}
            </button>
          )}
          <button onClick={() => setOpen(!open)} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
            <Icon d={open ? PATHS.x : PATHS.menu} size={20} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 70 }} />
          <aside style={{ position: 'fixed', left: 0, top: 0, height: '100vh', width: 260, background: '#fff', zIndex: 80, overflow: 'hidden', boxShadow: '4px 0 20px rgba(0,0,0,0.1)' }}>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Notification drawer */}
      {notifOpen && (
        <div style={{ position: 'fixed', right: 0, top: 0, height: '100vh', width: 360, maxWidth: '100vw', background: '#fff', borderLeft: '1px solid #e2e8f0', zIndex: 90, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.08)' }} className="animate-slide">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Notifications</span>
            <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifs.length === 0
              ? <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 40 }}>No notifications yet</div>
              : notifs.map(n => (
                <div key={n.id} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid', borderColor: n.read ? '#e2e8f0' : '#bfdbfe', background: n.read ? '#f8fafc' : '#eff6ff', position: 'relative' }}>
                  <button onClick={() => delNotif(n.id)} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14 }}>✕</button>
                  {!n.read && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#2563eb', marginBottom: 4 }} />}
                  <p style={{ fontSize: 13, color: '#0f172a', marginBottom: 4, paddingRight: 20 }}>{n.message}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8' }}>{n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleString() : ''}</p>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </>
  );
}
