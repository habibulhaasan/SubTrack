// src/components/Sidebar.js
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, limit, getDocs, getDoc } from 'firebase/firestore';

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const PATHS = {
  home:       'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  pay:        'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  ledger:     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8',
  expenses:   'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  invest:     'M22 12h-4l-3 9L9 3l-3 9H2',
  profile:    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  verify:     'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  members:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  settings:   'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  bell:       'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  logout:     'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  summary:    'M18 20V10M12 20V4M6 20v-6',                                             // bar chart
  income:     'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  penalty:    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  orgs:       'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  shield:     'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chevron:    'M9 18l6-6-6-6',
  grid:       'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  heart:      'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  menu:       'M3 12h18M3 6h18M3 18h18',
  x:          'M18 6L6 18M6 6l12 12',
  switch:     'M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4',
  star:       'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  // Distinct icons for items that were duplicated:
  monthlyLedger: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',              // list lines
  distribute:    'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6',                        // share/split arrows
  reports:       'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3 3 3-3', // doc with chart
  charity:       'M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z', // heart fill
  portfolio:     'M2 20h20M5 20V10l7-7 7 7v10M9 20v-5h6v5',                         // building/portfolio
  subscription:  'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', // package/box
};

const PUBLIC = ['/', '/login', '/register', '/forgot-password', '/create-org', '/select-org', '/join', '/pending-approval'];

function NavItem({ label, path, icon, pathname, onClick }) {
  const exactOnly = path === '/admin' || path === '/superadmin';
  const active = exactOnly
    ? pathname === path
    : (pathname === path || (path !== '/' && pathname.startsWith(path + '/')));
  return (
    <Link href={path} onClick={onClick}
      style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'8px', fontSize:'13px', fontWeight: active ? '600' : '400', color: active ? '#2563eb' : '#475569', background: active ? '#eff6ff' : 'transparent', textDecoration:'none', transition:'all 0.15s' }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background='#f8fafc'; e.currentTarget.style.color='#0f172a'; }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#475569'; }}}>
      <span style={{ color: active ? '#2563eb' : '#94a3b8', flexShrink:0 }}><Icon d={icon} size={15} /></span>
      {label}
    </Link>
  );
}

function SectionLabel({ label }) {
  return <p style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em', padding:'16px 12px 6px' }}>{label}</p>;
}

// Modal for superadmin to pick which org to enter
function OrgPickerModal({ onClose, onPick }) {
  const { user, userData } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Superadmin can read all orgs
        const snap = await getDocs(collection(db, 'organizations'));
        setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.name||'').localeCompare(b.name||'')));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user]);

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9000 }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#fff', borderRadius:16, width:'min(92vw,420px)', maxHeight:'80vh', display:'flex', flexDirection:'column', zIndex:9001, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:'#0f172a' }}>Enter Organization as Admin</div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Pick any org to access as superadmin</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:22, lineHeight:1 }}>×</button>
        </div>
        <div style={{ overflowY:'auto', padding:'10px 12px 16px', flex:1 }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:32, color:'#94a3b8', fontSize:13 }}>Loading…</div>
          ) : orgs.length === 0 ? (
            <div style={{ textAlign:'center', padding:32, color:'#94a3b8', fontSize:13 }}>No organizations yet.</div>
          ) : orgs.map(o => (
            <button key={o.id} onClick={() => onPick(o.id)}
              style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', marginBottom:6, textAlign:'left', transition:'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background='#eff6ff'; e.currentTarget.style.borderColor='#bfdbfe'; }}
              onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor='#e2e8f0'; }}>
              <div style={{ width:36, height:36, borderRadius:9, background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#1d4ed8', fontSize:14, flexShrink:0, overflow:'hidden' }}>
                {o.logoURL ? <img src={o.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (o.name?.[0]||'?')}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13, color:'#0f172a' }}>{o.name}</div>
                <div style={{ fontSize:11, color:'#94a3b8' }}>{o.type || '—'} · <span style={{ textTransform:'capitalize' }}>{o.status||'active'}</span></div>
              </div>
              <span style={{ fontSize:11, color:'#2563eb', fontWeight:600 }}>Enter →</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function Sidebar() {
  const [open, setOpen]         = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs]     = useState([]);
  const [showOrgPicker, setShowOrgPicker] = useState(false);
  const pathname = usePathname();
  const { user, userData, orgData, membership, isSuperAdmin, isOrgAdmin, accessMode, switchToOrgMode, switchToSuperAdminMode } = useAuth();

  const isPublic = PUBLIC.some(r => pathname === r || pathname.startsWith(r + '/'));
  const inOrgMode = isSuperAdmin && accessMode === 'org';

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

  const unread  = notifs.filter(n => !n.read).length;
  const initials = (userData?.nameEnglish || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const orgName  = orgData?.name || 'My Organization';

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

  // org features enabled for this org
  const orgFeatures = orgData?.features || {};

  const sidebarContent = (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Logo / header */}
      <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid #e2e8f0' }}>
        <Link href={inOrgMode ? '/dashboard' : (isSuperAdmin ? '/superadmin' : '/dashboard')}
          style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:36, height:36, borderRadius:10, background: inOrgMode ? '#7c3aed' : '#2563eb', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
            {orgData?.logoURL && (inOrgMode || !isSuperAdmin)
              ? <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
              : <Icon d={PATHS.heart} size={18} />}
          </div>
          <div>
            <div style={{ fontSize:'14px', fontWeight:'700', color:'#0f172a' }}>DonateTrack</div>
            <div style={{ fontSize:'11px', color: inOrgMode ? '#7c3aed' : '#94a3b8' }}>
              {inOrgMode ? orgName : (isSuperAdmin ? 'Super Admin' : orgName)}
            </div>
          </div>
        </Link>

        {/* Mode badge for superadmin */}
        {isSuperAdmin && (
          <div style={{ marginTop:10, padding:'6px 10px', borderRadius:8, background: inOrgMode ? '#f5f3ff' : '#eff6ff', border:`1px solid ${inOrgMode ? '#ddd6fe' : '#bfdbfe'}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color: inOrgMode ? '#7c3aed' : '#2563eb', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                {inOrgMode ? '🏢 Org Mode' : '🔧 Platform Mode'}
              </div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:1 }}>
                {inOrgMode ? (orgName) : 'Superadmin view'}
              </div>
            </div>
            <button
              onClick={() => inOrgMode ? switchToSuperAdminMode() : setShowOrgPicker(true)}
              style={{ fontSize:10, fontWeight:700, padding:'4px 8px', borderRadius:6, border:'none', cursor:'pointer', background: inOrgMode ? '#ede9fe' : '#dbeafe', color: inOrgMode ? '#7c3aed' : '#2563eb', whiteSpace:'nowrap', flexShrink:0 }}>
              {inOrgMode ? '← Platform' : 'Enter Org'}
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex:1, overflowY:'auto', padding:'8px' }}>

        {/* SUPERADMIN PLATFORM MODE */}
        {isSuperAdmin && !inOrgMode && (
          <>
            <SectionLabel label="Platform" />
            <NavItem label="Overview"          path="/superadmin"             icon={PATHS.grid}        pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Organizations"     path="/superadmin/orgs"        icon={PATHS.orgs}        pathname={pathname} onClick={closeDrawer} />
            <NavItem label="All Members"       path="/superadmin/members"     icon={PATHS.members}     pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Admin Management"  path="/superadmin/admins"      icon={PATHS.shield}      pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Org Features"      path="/superadmin/features"    icon={PATHS.star}        pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Platform Settings" path="/superadmin/settings"    icon={PATHS.settings}    pathname={pathname} onClick={closeDrawer} />
          </>
        )}

        {/* SUPERADMIN ORG MODE or REGULAR USER */}
        {(!isSuperAdmin || inOrgMode) && (
          <>
            {/* Org switcher chip */}
            <Link href="/select-org" onClick={closeDrawer}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, border:'1px solid #e2e8f0', margin:'4px 0 8px', textDecoration:'none', background:'#f8fafc', overflow:'hidden' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:1 }}>Current Org</div>
                <div style={{ fontSize:12, fontWeight:600, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{orgName}</div>
              </div>
              <div style={{ flexShrink:0, color:'#94a3b8' }}><Icon d={PATHS.chevron} size={12} /></div>
            </Link>

            {/* Member section */}
            <SectionLabel label="Member" />
            <NavItem label="Dashboard"       path="/dashboard"   icon={PATHS.home}     pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Pay Installment" path="/installment" icon={PATHS.pay}      pathname={pathname} onClick={closeDrawer} />
            <NavItem label="My Ledger"       path="/ledger"      icon={PATHS.ledger}   pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Expenses"        path="/expenses"    icon={PATHS.expenses} pathname={pathname} onClick={closeDrawer} />
            <NavItem label="Projects"        path="/investments" icon={PATHS.invest}   pathname={pathname} onClick={closeDrawer} />
            <NavItem label="My Profile"      path="/profile"     icon={PATHS.profile}  pathname={pathname} onClick={closeDrawer} />

            {isOrgAdmin && (
              <>
                {/* Finance section */}
                <SectionLabel label="Finance" />
                <NavItem label="Verify Payments"  path="/admin"                icon={PATHS.verify}        pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Income"           path="/admin/income"         icon={PATHS.income}        pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Expenses"         path="/admin/expenses"       icon={PATHS.expenses}      pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Penalties"        path="/admin/penalties"      icon={PATHS.penalty}       pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Investments"      path="/admin/investments"    icon={PATHS.invest}        pathname={pathname} onClick={closeDrawer} />

                {/* Reports section */}
                <SectionLabel label="Reports" />
                <NavItem label="Summary"          path="/admin/summary"        icon={PATHS.summary}       pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Monthly Ledger"   path="/admin/monthly-ledger" icon={PATHS.monthlyLedger} pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Member Ledger"    path="/admin/ledger"         icon={PATHS.ledger}        pathname={pathname} onClick={closeDrawer} />

                {/* People section */}
                <SectionLabel label="People" />
                <NavItem label="Member List"      path="/admin/members"        icon={PATHS.members}       pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Subscriptions"    path="/admin/subscriptions"  icon={PATHS.subscription}  pathname={pathname} onClick={closeDrawer} />
                <NavItem label="Notifications"    path="/admin/notifications"  icon={PATHS.bell}          pathname={pathname} onClick={closeDrawer} />

                {/* Features section — only if any enabled */}
                {(orgFeatures.profitDistribution || orgFeatures.advancedReports || orgFeatures.charityTracking || orgFeatures.investmentPortfolio) && (
                  <SectionLabel label="Features" />
                )}
                {orgFeatures.profitDistribution  && <NavItem label="Distribution" path="/admin/distribution" icon={PATHS.distribute}   pathname={pathname} onClick={closeDrawer} />}
                {orgFeatures.advancedReports      && <NavItem label="Reports"      path="/admin/reports"      icon={PATHS.reports}      pathname={pathname} onClick={closeDrawer} />}
                {orgFeatures.charityTracking      && <NavItem label="Charity"      path="/admin/charity"      icon={PATHS.charity}      pathname={pathname} onClick={closeDrawer} />}
                {orgFeatures.investmentPortfolio  && <NavItem label="Portfolio"    path="/admin/portfolio"    icon={PATHS.portfolio}    pathname={pathname} onClick={closeDrawer} />}

                {/* Config section */}
                <SectionLabel label="Config" />
                <NavItem label="Settings"         path="/admin/settings"       icon={PATHS.settings}      pathname={pathname} onClick={closeDrawer} />
              </>
            )}
          </>
        )}
      </nav>

      {/* Notifications bell — shown in org context */}
      {(!isSuperAdmin || inOrgMode) && (
        <div style={{ padding:'0 8px', borderTop:'1px solid #e2e8f0' }}>
          <button onClick={toggleNotif}
            style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#475569', borderRadius:8 }}>
            <div style={{ position:'relative' }}>
              <Icon d={PATHS.bell} size={15} />
              {unread > 0 && <span style={{ position:'absolute', top:-4, right:-4, width:14, height:14, background:'#dc2626', color:'#fff', fontSize:8, fontWeight:700, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>{unread}</span>}
            </div>
            <span>Notifications</span>
            {unread > 0 && <span style={{ marginLeft:'auto', fontSize:11, background:'#fee2e2', color:'#dc2626', padding:'1px 6px', borderRadius:99, fontWeight:600 }}>{unread}</span>}
          </button>
        </div>
      )}

      {/* User footer */}
      <div style={{ padding:'12px 8px', borderTop:'1px solid #e2e8f0', display:'flex', flexDirection:'column', gap:2 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
            {userData?.photoURL
              ? <img src={userData.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
              : <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8' }}>{initials}</span>}
          </div>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userData?.nameEnglish?.split(' ')[0] || 'User'}</div>
            <div style={{ fontSize:11, color:'#94a3b8', textTransform:'capitalize' }}>
              {inOrgMode ? 'superadmin (org)' : (isSuperAdmin ? 'superadmin' : (membership?.role || 'member'))}
            </div>
          </div>
        </div>
        <button onClick={logout}
          style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#94a3b8', width:'100%' }}
          onMouseEnter={e => { e.currentTarget.style.background='#fef2f2'; e.currentTarget.style.color='#dc2626'; }}
          onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#94a3b8'; }}>
          <Icon d={PATHS.logout} size={14} /><span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{ position:'fixed', left:0, top:0, height:'100vh', width:240, borderRight:'1px solid #e2e8f0', background:'#ffffff', zIndex:50, display:'none' }} className="md-sidebar">
        <style>{`.md-sidebar { display: block !important; } @media (max-width: 768px) { .md-sidebar { display: none !important; } }`}</style>
        {sidebarContent}
      </aside>

      {/* Mobile topbar */}
      <div style={{ position:'fixed', top:0, left:0, right:0, height:56, background:'#ffffff', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', zIndex:60 }} className="mobile-bar">
        <style>{`.mobile-bar { display: none; } @media (max-width: 768px) { .mobile-bar { display: flex !important; } }`}</style>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <div style={{ width:30, height:30, borderRadius:8, background: inOrgMode ? '#7c3aed' : '#2563eb', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
            {orgData?.logoURL && (inOrgMode || !isSuperAdmin)
              ? <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
              : <Icon d={PATHS.heart} size={14} />}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>
              {inOrgMode ? orgName : (isSuperAdmin ? 'DonateTrack' : (orgData?.name || 'DonateTrack'))}
            </div>
            <div style={{ fontSize:10, color: inOrgMode ? '#7c3aed' : '#94a3b8' }}>
              {inOrgMode ? '🏢 Org Mode' : (isSuperAdmin ? 'Super Admin' : 'DonateTrack')}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {(!isSuperAdmin || inOrgMode) && (
            <button onClick={toggleNotif} style={{ position:'relative', padding:6, background:'none', border:'none', cursor:'pointer', color:'#475569' }}>
              <Icon d={PATHS.bell} size={18} />
              {unread > 0 && <span style={{ position:'absolute', top:2, right:2, width:8, height:8, background:'#dc2626', borderRadius:'50%' }} />}
            </button>
          )}
          <button onClick={() => setOpen(!open)} style={{ padding:6, background:'none', border:'none', cursor:'pointer', color:'#475569' }}>
            <Icon d={open ? PATHS.x : PATHS.menu} size={20} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div onClick={closeDrawer} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:70 }} />
          <aside style={{ position:'fixed', left:0, top:0, height:'100vh', width:260, background:'#fff', zIndex:80, overflow:'hidden', boxShadow:'4px 0 20px rgba(0,0,0,0.1)' }}>
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Notification drawer */}
      {notifOpen && (
        <div style={{ position:'fixed', right:0, top:0, height:'100vh', width:360, maxWidth:'100vw', background:'#fff', borderLeft:'1px solid #e2e8f0', zIndex:90, display:'flex', flexDirection:'column', boxShadow:'-4px 0 20px rgba(0,0,0,0.08)' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:700, fontSize:15, color:'#0f172a' }}>Notifications</span>
            <button onClick={() => setNotifOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:18 }}>✕</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:10 }}>
            {notifs.length === 0
              ? <div style={{ textAlign:'center', color:'#94a3b8', fontSize:13, marginTop:40 }}>No notifications yet</div>
              : notifs.map(n => (
                <div key={n.id} style={{ padding:'12px 14px', borderRadius:10, border:'1px solid', borderColor: n.read ? '#e2e8f0' : '#bfdbfe', background: n.read ? '#f8fafc' : '#eff6ff', position:'relative' }}>
                  <button onClick={() => delNotif(n.id)} style={{ position:'absolute', top:8, right:10, background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:14 }}>✕</button>
                  {!n.read && <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#2563eb', marginBottom:4 }} />}
                  <p style={{ fontSize:13, color:'#0f172a', marginBottom:4, paddingRight:20 }}>{n.message}</p>
                  <p style={{ fontSize:11, color:'#94a3b8' }}>{n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleString() : ''}</p>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Org picker modal */}
      {showOrgPicker && (
        <OrgPickerModal
          onClose={() => setShowOrgPicker(false)}
          onPick={(orgId) => { setShowOrgPicker(false); closeDrawer(); switchToOrgMode(orgId); }}
        />
      )}
    </>
  );
}