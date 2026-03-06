// src/app/members/page.js  — Member Directory (feature-gated, read-only for members)
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const getInitials = n => (n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

function Avatar({ m, size=40 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:size*0.33, color:'#1d4ed8', flexShrink:0, overflow:'hidden' }}>
      {m.photoURL
        ? <img src={m.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
        : getInitials(m.nameEnglish)}
    </div>
  );
}

const BLOOD_COLORS = { 'A+':'#fee2e2','A-':'#fecaca','B+':'#fef3c7','B-':'#fed7aa','AB+':'#ede9fe','AB-':'#ddd6fe','O+':'#d1fae5','O-':'#bbf7d0' };

export default function MemberDirectory() {
  const { userData, orgData, membership } = useAuth();
  const [members, setMembers] = useState([]);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');

  const orgId   = userData?.activeOrgId;
  const features = orgData?.features || {};

  useEffect(() => {
    if (!orgId || !features.memberListVisible) return;
    // Real-time listener for members
    const unsub = onSnapshot(collection(db, 'organizations', orgId, 'members'), async snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.approved);
      const merged = await Promise.all(docs.map(async m => {
        try {
          const uSnap = await getDoc(doc(db, 'users', m.id));
          return uSnap.exists() ? { ...uSnap.data(), ...m } : m;
        } catch { return m; }
      }));
      setMembers(merged.sort((a,b) => (a.nameEnglish||'').localeCompare(b.nameEnglish||'')));
    });
    return unsub;
  }, [orgId, features.memberListVisible]);

  if (!features.memberListVisible) {
    return (
      <div className="page-wrap animate-fade">
        <div style={{ textAlign:'center', padding:'80px 20px' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
          <div style={{ fontWeight:700, fontSize:18, color:'#0f172a', marginBottom:8 }}>Member Directory Not Available</div>
          <div style={{ fontSize:14, color:'#64748b' }}>This feature is not enabled for your organization.</div>
        </div>
      </div>
    );
  }

  const bloodGroups = [...new Set(members.map(m => m.bloodGroup).filter(Boolean))].sort();
  const committeeRoles = [...new Set(members.map(m => m.committeeRole).filter(Boolean))].sort();

  const filtered = members.filter(m => {
    const q  = search.toLowerCase();
    const sf = !search
      || (m.nameEnglish||'').toLowerCase().includes(q)
      || (m.phone||'').includes(search)
      || (m.email||'').toLowerCase().includes(q)
      || (m.bloodGroup||'').toLowerCase().includes(q)
      || (m.committeeRole||'').toLowerCase().includes(q);
    const ff = filter === 'all'
      || (filter === m.bloodGroup)
      || (filter === m.committeeRole);
    return sf && ff;
  });

  return (
    <div className="page-wrap animate-fade">
      <div className="page-header" style={{ display:'flex', alignItems:'center', gap:14 }}>
        {orgData?.logoURL && (
          <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
            <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          </div>
        )}
        <div>
          <div className="page-title">Member Directory</div>
          <div className="page-subtitle">{members.length} approved member{members.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, phone, email, blood group…"
          style={{ flex:1, minWidth:180 }} />
        {(bloodGroups.length > 0 || committeeRoles.length > 0) && (
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ minWidth:140 }}>
            <option value="all">All Members</option>
            {bloodGroups.length > 0 && <optgroup label="Blood Group">
              {bloodGroups.map(bg => <option key={bg} value={bg}>Blood: {bg}</option>)}
            </optgroup>}
            {features.committeeRoles && committeeRoles.length > 0 && <optgroup label="Committee Role">
              {committeeRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </optgroup>}
          </select>
        )}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}>
          {search ? 'No members match your search.' : 'No approved members yet.'}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:14 }}>
          {filtered.map(m => (
            <div key={m.id} className="card" style={{ padding:'18px 20px', display:'flex', gap:14, alignItems:'flex-start' }}>
              <Avatar m={m} size={48} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:2 }}>{m.nameEnglish||'(no name)'}</div>
                {m.nameBengali && <div style={{ fontSize:12, color:'#64748b', marginBottom:6 }}>{m.nameBengali}</div>}

                {/* Committee role badge */}
                {features.committeeRoles && m.committeeRole && (
                  <div style={{ marginBottom:8 }}>
                    <span className="badge badge-blue" style={{ fontSize:10 }}>🎖️ {m.committeeRole}</span>
                  </div>
                )}

                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {m.phone && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#475569' }}>
                      <span style={{ color:'#94a3b8' }}>📞</span>
                      <a href={`tel:${m.phone}`} style={{ color:'#475569', textDecoration:'none' }}>{m.phone}</a>
                    </div>
                  )}
                  {m.email && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#475569', minWidth:0 }}>
                      <span style={{ color:'#94a3b8', flexShrink:0 }}>✉️</span>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.email}</span>
                    </div>
                  )}
                  {m.bloodGroup && (
                    <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, marginTop:2 }}>
                      <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700, background: BLOOD_COLORS[m.bloodGroup]||'#f1f5f9', color:'#0f172a' }}>
                        🩸 {m.bloodGroup}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}