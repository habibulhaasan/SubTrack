'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const initials = n => (n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

const MODAL_STYLES = `
  .mem-overlay {
    position: fixed;
    inset: 0;
    top: 56px;
    background: rgba(0,0,0,.55);
    z-index: 9000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .mem-sheet {
    background: #fff;
    width: 100%;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: 20px 20px 0 0;
    animation: memUp .28s cubic-bezier(.32,1,.32,1) both;
  }
  .mem-handle {
    width: 40px; height: 4px;
    background: #cbd5e1; border-radius: 99px;
    margin: 12px auto 4px; flex-shrink: 0;
  }
  .mem-body {
    padding: 8px 20px 40px;
  }
  .mem-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  @keyframes memUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @media (min-width: 769px) {
    .mem-overlay {
      top: 0;
      align-items: center;
      padding: 24px;
      margin-top: 40vh; 
    }
    .mem-sheet {
      max-width: 500px;
      max-height: 88vh;
      border-radius: 16px;
      animation: memPop .2s ease both;
    }
    .mem-handle { display: none; }
    .mem-body { padding: 20px 28px 32px; }
  }
  @keyframes memPop {
    from { transform: scale(.96) translateY(8px); opacity: 0; }
    to   { transform: scale(1) translateY(0); opacity: 1; }
  }
`;

function Avatar({ m, size=36 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:size*0.35, color:'#1d4ed8', flexShrink:0, overflow:'hidden' }}>
      {m.photoURL ? <img src={m.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : initials(m.nameEnglish)}
    </div>
  );
}

function MemberModal({ member, onClose, onToggleApproval, onSaveId, settings, nextId, saving }) {
  const [idEdit, setIdEdit] = useState(member.idNo || '');
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const InfoRow = ({ label, value }) => !value ? null : (
    <div style={{ display:'flex', justifyContent:'space-between', gap:12, fontSize:13, padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
      <span style={{ color:'#64748b', flexShrink:0 }}>{label}</span>
      <span style={{ fontWeight:500, color:'#0f172a', textAlign:'right', wordBreak:'break-word' }}>{value}</span>
    </div>
  );

  return (
    <>
      <style>{MODAL_STYLES}</style>
      <div className="mem-overlay" onClick={onClose}>
        <div className="mem-sheet" onClick={e => e.stopPropagation()}>
          <div className="mem-handle" />
          <div className="mem-body">
            <div className="mem-head">
              <span style={{ fontWeight:700, fontSize:15, color:'#0f172a' }}>Member Profile</span>
              <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:28, lineHeight:1, padding:'0 0 0 12px' }}>×</button>
            </div>

            <div style={{ textAlign:'center', marginBottom:20 }}>
              <Avatar m={member} size={64} />
              <div style={{ marginTop:10, fontWeight:700, fontSize:17 }}>{member.nameEnglish || '(no name)'}</div>
              {member.nameBengali && <div style={{ fontSize:13, color:'#64748b', marginTop:2 }}>{member.nameBengali}</div>}
              <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:10 }}>
                <span className={`badge ${member.approved?'badge-green':'badge-yellow'}`}>{member.approved?'Approved':'Pending'}</span>
                <span className={`badge ${member.role==='admin'?'badge-blue':'badge-gray'}`}>{member.role||'member'}</span>
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <label className="form-label">
                Member ID
                {settings.autoMemberId && <span style={{ fontWeight:400, textTransform:'none', marginLeft:4, color:'#94a3b8' }}>(auto on approve)</span>}
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <input value={idEdit} onChange={e=>setIdEdit(e.target.value)}
                  placeholder={settings.autoMemberId ? `Next: ${nextId}` : 'e.g. M-001'}
                  style={{ flex:1 }} />
                <button onClick={() => onSaveId(member.id, idEdit)} disabled={saving===member.id+'_id'}
                  className="btn-primary" style={{ padding:'10px 14px' }}>
                  {saving===member.id+'_id' ? '…' : 'Save'}
                </button>
              </div>
            </div>

            <InfoRow label="Email"       value={member.email} />
            <InfoRow label="Phone"       value={member.phone} />
            <InfoRow label="Blood Group" value={member.bloodGroup} />
            <InfoRow label="NID"         value={member.nid} />
            <InfoRow label="Occupation"  value={member.occupation} />
            <InfoRow label="DOB"         value={member.dob} />
            <InfoRow label="Father"      value={member.fatherName} />
            <InfoRow label="Address"     value={member.address} />

            <button onClick={() => onToggleApproval(member)} disabled={saving===member.id}
              style={{ width:'100%', marginTop:18, padding:'12px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:600, fontSize:14,
                background: member.approved ? '#fee2e2' : '#dcfce7',
                color:      member.approved ? '#b91c1c' : '#15803d',
                opacity: saving===member.id ? .6 : 1 }}>
              {saving===member.id ? '…' : member.approved ? 'Suspend Member' : 'Approve Member'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminMembers() {
  const { userData, orgData } = useAuth();
  const [members, setMembers]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [saving, setSaving]     = useState(null);
  const orgId    = userData?.activeOrgId;
  const settings = orgData?.settings || {};

  useEffect(() => {
    if (!orgId) return;
    const unsub = onSnapshot(collection(db,'organizations',orgId,'members'), async snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      const merged = await Promise.all(docs.map(async m => {
        try { const u = await getDoc(doc(db,'users',m.id)); return u.exists() ? { ...u.data(), ...m } : m; }
        catch { return m; }
      }));
      setMembers(merged);
      setSelected(s => s ? (merged.find(m=>m.id===s.id)||null) : null);
    });
    return unsub;
  }, [orgId]);

  const nextMemberId = () => {
    const prefix = settings.memberIdPrefix || 'M';
    const nums = members.map(m=>m.idNo||'').filter(id=>id.startsWith(prefix+'-')).map(id=>parseInt(id.split('-')[1])||0);
    return `${prefix}-${String((nums.length ? Math.max(...nums) : 0)+1).padStart(3,'0')}`;
  };

  const toggleApproval = async m => {
    setSaving(m.id);
    try {
      const nowApproved = !m.approved;
      const update = { approved: nowApproved };
      if (nowApproved && settings.autoMemberId && !m.idNo) update.idNo = nextMemberId();
      await updateDoc(doc(db,'organizations',orgId,'members',m.id), update);
      const msg = nowApproved
        ? `✅ Your membership has been approved! Welcome to ${orgData?.name || 'the organization'}.`
        : `⚠️ Your membership has been suspended. Please contact admin for more details.`;
      await addDoc(collection(db,'organizations',orgId,'notifications'), {
        userId: m.id, message: msg, read: false, createdAt: serverTimestamp(),
      });
    } catch(e) { alert(e.message); }
    setSaving(null);
  };

  const saveId = async (uid, val) => {
    setSaving(uid+'_id');
    try { await updateDoc(doc(db,'organizations',orgId,'members',uid), { idNo:val }); }
    catch(e) { alert(e.message); }
    setSaving(null);
  };

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const sf = !search
      || (m.nameEnglish||'').toLowerCase().includes(q)
      || (m.phone||'').includes(search)
      || (m.email||'').toLowerCase().includes(q)
      || (m.idNo||'').includes(search);
    const ff = filter==='all' || (filter==='approved' ? m.approved : !m.approved);
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
          <div className="page-title">Members</div>
          <div className="page-subtitle">
            {members.length} total · {members.filter(m=>!m.approved).length} pending
            {settings.autoMemberId && <span style={{ marginLeft:8, fontSize:11, background:'#eff6ff', color:'#2563eb', padding:'2px 8px', borderRadius:4, fontWeight:600 }}>Auto-ID</span>}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search name, phone, ID…" style={{ flex:1, minWidth:160 }} />
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          {['all','approved','pending'].map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              className={filter===f ? 'btn-primary' : 'btn-ghost'}
              style={{ padding:'9px 14px', fontSize:12, textTransform:'capitalize' }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap"><div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>ID</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', color:'#94a3b8', padding:40 }}>No members found</td></tr>
            ) : filtered.map(m => (
              <tr key={m.id} onClick={() => setSelected(m)} style={{ cursor:'pointer' }}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Avatar m={m} size={34} />
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{m.nameEnglish||'(no name)'}</div>
                      {m.nameBengali && <div style={{ fontSize:11, color:'#94a3b8' }}>{m.nameBengali}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ fontSize:12, color:'#475569', fontFamily:'monospace' }}>{m.idNo||'—'}</td>
                <td style={{ fontSize:12, color:'#475569' }}>{m.phone||'—'}</td>
                <td>
                  <span className={`badge ${m.role==='admin'?'badge-blue':'badge-gray'}`} style={{ fontSize:10, textTransform:'capitalize' }}>
                    {m.role||'member'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${m.approved?'badge-green':'badge-yellow'}`} style={{ fontSize:10 }}>
                    {m.approved?'Approved':'Pending'}
                  </span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => toggleApproval(m)}
                    disabled={saving===m.id}
                    style={{ padding:'4px 12px', fontSize:11, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', whiteSpace:'nowrap',
                      background: m.approved ? '#fee2e2' : '#dcfce7',
                      color:      m.approved ? '#b91c1c' : '#15803d',
                      opacity: saving===m.id ? .6 : 1 }}>
                    {saving===m.id ? '…' : m.approved ? 'Suspend' : 'Approve'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>

      {selected && (
        <MemberModal
          member={selected}
          onClose={() => setSelected(null)}
          onToggleApproval={toggleApproval}
          onSaveId={saveId}
          settings={settings}
          nextId={nextMemberId()}
          saving={saving}
        />
      )}
    </div>
  );
}
