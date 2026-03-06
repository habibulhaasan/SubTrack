// src/app/members/page.js  — Member Directory (table view, feature-gated)
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const getInitials = n => (n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

const BLOOD_BG = { 'A+':'#fee2e2','A-':'#fecaca','B+':'#fef3c7','B-':'#fed7aa','AB+':'#ede9fe','AB-':'#ddd6fe','O+':'#d1fae5','O-':'#bbf7d0' };

function Avatar({ m, size=30 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:size*0.36, color:'#1d4ed8', flexShrink:0, overflow:'hidden' }}>
      {m.photoURL ? <img src={m.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : getInitials(m.nameEnglish)}
    </div>
  );
}

export default function MemberDirectory() {
  const { userData, orgData } = useAuth();
  const [members, setMembers] = useState([]);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');

  const orgId    = userData?.activeOrgId;
  const features = orgData?.features || {};

  useEffect(() => {
    if (!orgId || !features.memberListVisible) return;
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

  const bloodGroups    = [...new Set(members.map(m => m.bloodGroup).filter(Boolean))].sort();
  const committeeRoles = [...new Set(members.map(m => m.committeeRole).filter(Boolean))].sort();

  const filtered = members.filter(m => {
    const q  = search.toLowerCase();
    const sf = !search
      || (m.nameEnglish||'').toLowerCase().includes(q)
      || (m.phone||'').includes(search)
      || (m.email||'').toLowerCase().includes(q)
      || (m.bloodGroup||'').toLowerCase().includes(q)
      || (m.committeeRole||'').toLowerCase().includes(q)
      || (m.idNo||'').includes(search);
    const ff = filter === 'all' || filter === m.bloodGroup || filter === m.committeeRole;
    return sf && ff;
  });

  const showCommittee = features.committeeRoles && committeeRoles.length > 0;

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
          placeholder="Search name, phone, email, blood group, ID…"
          style={{ flex:1, minWidth:180 }} />
        {(bloodGroups.length > 0 || committeeRoles.length > 0) && (
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ minWidth:160 }}>
            <option value="all">All Members</option>
            {bloodGroups.length > 0 && (
              <optgroup label="Blood Group">
                {bloodGroups.map(bg => <option key={bg} value={bg}>🩸 {bg}</option>)}
              </optgroup>
            )}
            {features.committeeRoles && committeeRoles.length > 0 && (
              <optgroup label="Committee Role">
                {committeeRoles.map(r => <option key={r} value={r}>🎖️ {r}</option>)}
              </optgroup>
            )}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}>
          {search || filter !== 'all' ? 'No members match your search.' : 'No approved members yet.'}
        </div>
      ) : (
        <div className="table-wrap"><div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Member</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Blood</th>
                {showCommittee && <th>Committee</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id}>
                  <td style={{ fontSize:12, color:'#94a3b8', width:36 }}>{i+1}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Avatar m={m} size={32} />
                      <div>
                        <div style={{ fontWeight:600, fontSize:13, color:'#0f172a' }}>{m.nameEnglish||'(no name)'}</div>
                        {m.nameBengali && <div style={{ fontSize:11, color:'#94a3b8' }}>{m.nameBengali}</div>}
                        {m.idNo && <div style={{ fontSize:10, color:'#94a3b8', fontFamily:'monospace' }}>{m.idNo}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    {m.phone
                      ? <a href={`tel:${m.phone}`} style={{ fontSize:13, color:'#475569', textDecoration:'none' }}>{m.phone}</a>
                      : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}
                  </td>
                  <td style={{ fontSize:12, color:'#475569', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {m.email || <span style={{ color:'#94a3b8' }}>—</span>}
                  </td>
                  <td>
                    {m.bloodGroup
                      ? (
                        <span style={{ padding:'2px 9px', borderRadius:99, fontSize:12, fontWeight:700, background: BLOOD_BG[m.bloodGroup]||'#f1f5f9', color:'#0f172a' }}>
                          {m.bloodGroup}
                        </span>
                      )
                      : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}
                  </td>
                  {showCommittee && (
                    <td>
                      {m.committeeRole
                        ? <span className="badge badge-blue" style={{ fontSize:11 }}>🎖️ {m.committeeRole}</span>
                        : <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  );
}