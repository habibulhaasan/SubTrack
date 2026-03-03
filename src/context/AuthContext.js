// src/context/AuthContext.js
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext({});

const PUBLIC = [
  '/', '/login', '/register', '/forgot-password',
  '/select-org', '/create-org', '/join',
  '/pending-approval', '/org-pending',
  '/superadmin',
];

// accessMode stored in localStorage:
//   'superadmin' → platform view (default for superadmins)
//   'org'        → acting inside a specific org as admin/member

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [userData, setUserData]       = useState(null);
  const [orgData, setOrgData]         = useState(null);
  const [membership, setMembership]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [accessMode, setAccessModeState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dt_access_mode') || 'superadmin';
    }
    return 'superadmin';
  });

  const router   = useRouter();
  const pathname = usePathname();

  const setAccessMode = (mode) => {
    setAccessModeState(mode);
    if (typeof window !== 'undefined') localStorage.setItem('dt_access_mode', mode);
  };

  // Called from Sidebar or anywhere — superadmin enters an org
  const switchToOrgMode = async (orgId) => {
    if (orgId && user) {
      // Update activeOrgId so the effect loads the right org
      await setDoc(doc(db, 'users', user.uid), { activeOrgId: orgId }, { merge: true });
    }
    setAccessMode('org');
    router.push('/dashboard');
  };

  // Return to platform view
  const switchToSuperAdminMode = () => {
    setAccessMode('superadmin');
    router.push('/superadmin');
  };

  useEffect(() => {
    let unsubUser = null;
    let unsubOrg  = null;
    let unsubMem  = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubUser) { unsubUser(); unsubUser = null; }
      if (unsubOrg)  { unsubOrg();  unsubOrg  = null; }
      if (unsubMem)  { unsubMem();  unsubMem  = null; }

      const isPublic = PUBLIC.some(r => pathname === r || pathname.startsWith(r + '/'));

      if (!firebaseUser) {
        setUser(null); setUserData(null); setOrgData(null); setMembership(null);
        if (!isPublic) router.push('/login');
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      unsubUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (uSnap) => {
        if (!uSnap.exists()) { setLoading(false); return; }
        const uData = uSnap.data();
        setUserData(uData);

        const isSA = uData.role === 'superadmin';

        // Superadmin in platform mode — skip org loading entirely
        if (isSA && accessMode === 'superadmin') {
          setOrgData(null);
          setMembership(null);
          setLoading(false);
          return;
        }

        // Regular user OR superadmin in org mode — load org + membership
        if (uData.activeOrgId) {
          if (unsubOrg) { unsubOrg(); unsubOrg = null; }
          if (unsubMem) { unsubMem(); unsubMem = null; }

          unsubOrg = onSnapshot(doc(db, 'organizations', uData.activeOrgId), (orgSnap) => {
            if (orgSnap.exists()) {
              const oData = { id: orgSnap.id, ...orgSnap.data() };
              setOrgData(oData);
              // Superadmin in org mode can access even pending orgs — no redirect
              if (!isSA && oData.status === 'pending' && !isPublic && pathname !== '/org-pending') {
                router.push('/org-pending');
              }
            }
          });

          unsubMem = onSnapshot(
            doc(db, 'organizations', uData.activeOrgId, 'members', firebaseUser.uid),
            (mSnap) => {
              if (mSnap.exists()) {
                const mData = { id: mSnap.id, ...mSnap.data() };
                setMembership(mData);
                // Superadmin never gets blocked by pending approval
                if (!isSA && !mData.approved && !isPublic && pathname !== '/pending-approval') {
                  router.push('/pending-approval');
                }
              } else {
                // Superadmin may not be a formal member — still OK
                setMembership(null);
              }
              setLoading(false);
            }
          );
        } else {
          setOrgData(null);
          setMembership(null);
          if (!isSA && !isPublic) router.push('/select-org');
          if (isSA && accessMode === 'org') router.push('/select-org');
          setLoading(false);
        }
      }, (err) => {
        console.error('AuthContext error:', err);
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
      if (unsubOrg)  unsubOrg();
      if (unsubMem)  unsubMem();
    };
  }, [pathname, accessMode]); // re-run when accessMode changes

  const isSuperAdmin = userData?.role === 'superadmin';

  // In org mode superadmin acts as admin for the selected org
  // (Firestore rules already allow superadmin to do all writes)
  const isOrgAdmin = membership?.role === 'admin' || (isSuperAdmin && accessMode === 'org');

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f8fafc' }}>
      <div style={{ width:32, height:32, border:'3px solid #bfdbfe', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ marginTop:12, fontSize:13, color:'#94a3b8' }}>Loading…</p>
    </div>
  );

  return (
    <AuthContext.Provider value={{
      user, userData, orgData, membership, loading,
      isSuperAdmin, isOrgAdmin,
      accessMode,
      switchToOrgMode,
      switchToSuperAdminMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);