'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, getDocs, collection } from 'firebase/firestore';
import Link from 'next/link';

export default function SelectOrg() {
  const { user, userData } = useAuth();
  const [orgs, setOrgs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(null);

  useEffect(() => {
    if (!user || !userData) return;

    (async () => {
      try {
        // The user doc stores an array of orgIds they belong to.
        // If that doesn't exist yet, fall back to scanning known orgIds.
        const orgIds = userData.orgIds || (userData.activeOrgId ? [userData.activeOrgId] : []);

        const list = [];

        for (const orgId of orgIds) {
          try {
            // Read own member doc — rules allow: isOwnDoc(memberId)
            const [orgSnap, memberSnap] = await Promise.all([
              getDoc(doc(db, 'organizations', orgId)),
              getDoc(doc(db, 'organizations', orgId, 'members', user.uid)),
            ]);
            if (orgSnap.exists() && memberSnap.exists()) {
              list.push({ id: orgId, ...orgSnap.data(), membership: memberSnap.data() });
            }
          } catch {
            // Skip any org we can't access
          }
        }

        setOrgs(list);
      } catch (e) {
        console.error('select-org:', e);
      }
      setLoading(false);
    })();
  }, [user, userData]);

  const switchOrg = async (orgId) => {
    setSwitching(orgId);
    // Add this orgId to the user's orgIds array for future use
    const existing = userData?.orgIds || [];
    const orgIds   = existing.includes(orgId) ? existing : [...existing, orgId];
    await updateDoc(doc(db, 'users', user.uid), { activeOrgId: orgId, orgIds });
    window.location.href = '/dashboard';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
      <div style={{ maxWidth: 560, margin: '40px auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Your Organizations</h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>Select an organization to continue</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
        ) : orgs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: '#64748b', marginBottom: 20 }}>You're not part of any organization yet.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Link href="/create-org" className="btn-primary">Create Organization</Link>
              <Link href="/join" className="btn-ghost">Join via Invite</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orgs.map(org => {
              const isActive = userData?.activeOrgId === org.id;
              return (
                <div
                  key={org.id}
                  className="card"
                  onClick={() => !isActive && switchOrg(org.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: isActive ? 'default' : 'pointer', border: isActive ? '1.5px solid #2563eb' : '1px solid #e2e8f0', background: isActive ? '#eff6ff' : '#fff' }}
                >
                 <div style={{ width: 44, height: 44, borderRadius: 12, background: isActive ? '#2563eb' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: isActive ? '#fff' : '#475569', flexShrink: 0, overflow: 'hidden' }}>
  {org.logoUrl
    ? <img src={org.logoUrl} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    : org.name?.[0]?.toUpperCase()
  }
</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 15 }}>{org.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {org.type} · <span style={{ textTransform: 'capitalize' }}>{org.membership?.role}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {isActive && <span className="badge badge-blue">Active</span>}
                    {!org.membership?.approved && <span className="badge badge-yellow">Pending</span>}
                    {switching === org.id && <span style={{ fontSize: 12, color: '#94a3b8' }}>Switching…</span>}
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Link href="/create-org" className="btn-ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                + New Organization
              </Link>
              <Link href="/join" className="btn-ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Join via Invite
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}