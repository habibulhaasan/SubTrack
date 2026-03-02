'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

export default function SuperAdminAdmins() {
  const { isSuperAdmin } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [selOrg, setSelOrg] = useState('');
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsub = onSnapshot(collection(db,'organizations'), snap => setOrgs(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!selOrg) { setMembers([]); return; }
    const unsub = onSnapshot(collection(db,'organizations',selOrg,'members'), snap => setMembers(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  }, [selOrg]);

  const toggle = async (m) => {
    const newRole = m.role==='admin' ? 'member' : 'admin';
    setSaving(m.id);
    try { await updateDoc(doc(db,'organizations',selOrg,'members',m.id), { role: newRole }); }
    catch (e) { alert(e.message); }
    setSaving(null);
  };

  const filtered = members.filter(m => (m.nameEnglish||'').toLowerCase().includes(search.toLowerCase()));
  if (!isSuperAdmin) return null;

  return (
    <div className="page-wrap animate-fade">
      <div className="page-header">
        <div style={{ fontSize:11, fontWeight:600, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Super Admin</div>
        <div className="page-title">Admin Management</div>
        <div className="page-subtitle">Assign or revoke admin roles in any organization</div>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:200 }}>
          <label className="form-label">Organization</label>
          <select value={selOrg} onChange={e=>{ setSelOrg(e.target.value); setSearch(''); }}>
            <option value="">— Choose —</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        {selOrg && <div style={{ flex:1, minWidth:200 }}>
          <label className="form-label">Search</label>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter members…" />
        </div>}
      </div>

      {selOrg && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Member</th><th>Current Role</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.length===0
                ? <tr><td colSpan={4} style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>No members</td></tr>
                : filtered.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight:500 }}>{m.nameEnglish||m.id.slice(0,10)}</td>
                    <td><span className={`badge ${m.role==='admin'?'badge-blue':'badge-gray'}`} style={{ textTransform:'capitalize' }}>{m.role||'member'}</span></td>
                    <td><span className={`badge ${m.approved?'badge-green':'badge-yellow'}`}>{m.approved?'Approved':'Pending'}</span></td>
                    <td>
                      <button onClick={()=>toggle(m)} disabled={saving===m.id}
                        style={{ padding:'6px 14px', fontSize:12, borderRadius:6, border:'none', cursor:'pointer', fontWeight:600, background: m.role==='admin'?'#fee2e2':'#dcfce7', color: m.role==='admin'?'#b91c1c':'#15803d' }}>
                        {saving===m.id?'…':m.role==='admin'?'Revoke Admin':'Make Admin'}
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
