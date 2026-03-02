'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext({});

const PUBLIC = [
  '/', '/login', '/register', '/forgot-password',
  '/select-org', '/create-org', '/join',
  '/pending-approval', '/org-pending',
  '/superadmin', // superadmin has no org, must not redirect
];

export const AuthProvider = ({ children }) => {
  const [user, setUser]             = useState(null);
  const [userData, setUserData]     = useState(null);
  const [orgData, setOrgData]       = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading]       = useState(true);
  const router   = useRouter();
  const pathname = usePathname();

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

        if (uData.role === 'superadmin') { setLoading(false); return; }

        if (uData.activeOrgId) {
          if (unsubOrg) { unsubOrg(); unsubOrg = null; }
          if (unsubMem) { unsubMem(); unsubMem = null; }

          unsubOrg = onSnapshot(doc(db, 'organizations', uData.activeOrgId), (orgSnap) => {
            if (orgSnap.exists()) {
              const oData = { id: orgSnap.id, ...orgSnap.data() };
              setOrgData(oData);
              // Only redirect to org-pending if org is pending AND user is NOT the creator/admin
              // (admin needs to see pending page; members can't access a pending org at all)
              if (oData.status === 'pending' && !isPublic && pathname !== '/org-pending') {
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

                // If member not yet approved, redirect to pending-approval
                if (!mData.approved && !isPublic && pathname !== '/pending-approval') {
                  router.push('/pending-approval');
                }
              } else {
                setMembership(null);
              }
              setLoading(false);
            }
          );
        } else {
          setOrgData(null); setMembership(null);
          if (!isPublic) router.push('/select-org');
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
  }, [pathname]);

  const isSuperAdmin = userData?.role === 'superadmin';
  const isOrgAdmin   = membership?.role === 'admin';

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f8fafc' }}>
      <div style={{ width:32, height:32, border:'3px solid #bfdbfe', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ marginTop:12, fontSize:13, color:'#94a3b8' }}>Loading…</p>
    </div>
  );

  return (
    <AuthContext.Provider value={{ user, userData, orgData, membership, loading, isSuperAdmin, isOrgAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
