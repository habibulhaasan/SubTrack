// src/app/admin/members/page.js
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/Modal';

const getInitials = n => (n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const COMMITTEE_PRESETS = ['President','Vice President','Secretary','Joint Secretary','Treasurer','Assistant Treasurer','Organizer','Advisor','Member'];

function Avatar({ m, size = 36 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:size*0.35, color:'#1d4ed8', flexShrink:0, overflow:'hidden' }}>
      {m.photoURL
        ? <img src={m.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
        : getInitials(m.nameEnglish)}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:12, fontSize:13, padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
      <span style={{ color:'#64748b', flexShrink:0 }}>{label}</span>
      <span style={{ fontWeight:500, color:'#0f172a', textAlign:'right', wordBreak:'break-word' }}>{value}</span>
    </div>
  );
}

function MemberModal({ member, onClose, onToggleApproval, onSaveId, onSaveCashier, onSaveCommittee, settings, nextId, saving, orgData, members }) {
  const [idEdit, setIdEdit]             = useState(member.idNo || '');
  const [committeeEdit, setCommitteeEdit] = useState(member.committeeRole || '');
  const [cashierMethods, setCashierMethods] = useState(member.cashierMethods || []);
  const [activeTab, setActiveTab]       = useState('profile');

  useEffect(() => {
    setIdEdit(member.idNo || '');
    setCommitteeEdit(member.committeeRole || '');
    setCashierMethods(member.cashierMethods || []);
  }, [member.idNo, member.committeeRole, JSON.stringify(member.cashierMethods)]);

  const features     = orgData?.features || {};
  const limits       = orgData?.limits   || {};
  const enabledMethods = settings.paymentMethods || ['bKash','Nagad','Rocket','Bank Transfer','Cash'];
  const paymentAccounts = settings.paymentAccounts || {};

  // Count current cashiers (excluding this member)
  const currentCashierCount = members.filter(m => m.role === 'cashier' && m.id !== member.id).length;
  const maxCashiers = limits.maxCashiers;

  const roleBadge = r => r === 'admin' ? 'badge-blue' : r === 'cashier' ? 'badge-yellow' : 'badge-gray';

  const tabs = [
    { id:'profile', label:'Profile' },
    ...(features.cashierRole ? [{ id:'cashier', label:'Cashier' }] : []),
    ...(features.committeeRoles ? [{ id:'committee', label:'Committee' }] : []),
  ];

  return (
    <Modal title="Member Profile" onClose={onClose}>
      {/* Avatar + name */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', marginBottom:16 }}>
        <Avatar m={member} size={64} />
        <div style={{ marginTop:10, fontWeight:700, fontSize:17, color:'#0f172a' }}>{member.nameEnglish || '(no name)'}</div>
        {member.nameBengali && <div style={{ fontSize:13, color:'#64748b', marginTop:2 }}>{member.nameBengali}</div>}
        <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:10, flexWrap:'wrap' }}>
          <span className={`badge ${member.approved ? 'badge-green' : 'badge-yellow'}`}>{member.approved ? 'Approved' : 'Pending'}</span>
          <span className={`badge ${roleBadge(member.role)}`} style={{ textTransform:'capitalize' }}>{member.role || 'member'}</span>
          {member.committeeRole && features.committeeRoles && (
            <span className="badge badge-blue" style={{ fontSize:10 }}>🎖️ {member.committeeRole}</span>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      {tabs.length > 1 && (
        <div style={{ display:'flex', gap:4, borderBottom:'2px solid #e2e8f0', marginBottom:16 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding:'8px 14px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight: activeTab===t.id ? 600 : 400, color: activeTab===t.id ? '#2563eb' : '#64748b', borderBottom: activeTab===t.id ? '2px solid #2563eb' : '2px solid transparent', marginBottom:-2 }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Profile tab ── */}
      {activeTab === 'profile' && (
        <>
          <div style={{ marginBottom:16 }}>
            <label className="form-label">
              Member ID
              {settings.autoMemberId && <span style={{ fontWeight:400, textTransform:'none', marginLeft:4, color:'#94a3b8' }}>(auto on approve)</span>}
            </label>
            <div style={{ display:'flex', gap:8 }}>
              <input value={idEdit} onChange={e => setIdEdit(e.target.value)}
                placeholder={settings.autoMemberId ? `Next: ${nextId}` : 'e.g. M-001'} style={{ flex:1 }} />
              <button onClick={() => onSaveId(member.id, idEdit)} disabled={saving === member.id+'_id'}
                className="btn-primary" style={{ padding:'10px 14px' }}>
                {saving === member.id+'_id' ? '…' : 'Save'}
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

          <button
            onClick={() => onToggleApproval(member)}
            disabled={saving === member.id}
            style={{ width:'100%', marginTop:18, padding:'12px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:600, fontSize:14,
              background: member.approved ? '#fee2e2' : '#dcfce7',
              color:      member.approved ? '#b91c1c' : '#15803d',
              opacity: saving === member.id ? .6 : 1 }}>
            {saving === member.id ? '…' : member.approved ? 'Suspend Member' : 'Approve Member'}
          </button>
        </>
      )}

      {/* ── Cashier tab ── */}
      {activeTab === 'cashier' && features.cashierRole && (
        <div>
          <div className="alert alert-info" style={{ marginBottom:16, fontSize:13 }}>
            A cashier can verify incoming payments for their assigned payment methods. They cannot edit or delete any other records.
          </div>

          {/* Role toggle */}
          <div className="card" style={{ marginBottom:16, padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14, color:'#0f172a' }}>Cashier Role</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                  {member.role === 'cashier' ? 'This member is currently a cashier.' : 'Assign cashier role to this member.'}
                </div>
                {maxCashiers > 0 && (
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>
                    Org limit: {currentCashierCount}/{maxCashiers} cashiers used
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (member.role !== 'cashier') {
                    if (maxCashiers > 0 && currentCashierCount >= maxCashiers) {
                      alert(`Cashier limit reached (${maxCashiers}). Remove a cashier first.`);
                      return;
                    }
                  }
                  onSaveCashier(member.id, member.role === 'cashier' ? 'member' : 'cashier', cashierMethods);
                }}
                disabled={saving === member.id+'_role'}
                style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:600, fontSize:13, flexShrink:0,
                  background: member.role === 'cashier' ? '#fee2e2' : '#dcfce7',
                  color:      member.role === 'cashier' ? '#b91c1c' : '#15803d',
                  opacity: saving === member.id+'_role' ? .6 : 1 }}>
                {saving === member.id+'_role' ? '…' : member.role === 'cashier' ? 'Remove Cashier' : 'Make Cashier'}
              </button>
            </div>
          </div>

          {/* Assign payment methods */}
          {(member.role === 'cashier' || saving === member.id+'_role') && (
            <div className="card" style={{ padding:'14px 16px' }}>
              <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:4 }}>Assigned Payment Methods</div>
              <p style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
                Select which payment methods this cashier handles. Account numbers are shown for reference.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {enabledMethods.map(m => {
                  const accs = paymentAccounts[m] || [];
                  const checked = cashierMethods.includes(m);
                  return (
                    <label key={m} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', border:`1.5px solid ${checked ? '#bfdbfe' : '#e2e8f0'}`, borderRadius:8, background: checked ? '#f0f7ff' : '#fff', cursor:'pointer' }}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setCashierMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                        style={{ marginTop:2, flexShrink:0, accentColor:'#2563eb' }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:13, color: checked ? '#1d4ed8' : '#0f172a' }}>{m}</div>
                        {accs.length > 0 && (
                          <div style={{ marginTop:4 }}>
                            {accs.map(a => (
                              <div key={a.id} style={{ fontSize:11, color:'#64748b' }}>
                                {a.label}: <span style={{ fontFamily:'monospace', color:'#475569' }}>{a.number}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {accs.length === 0 && m !== 'Cash' && (
                          <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>No account configured in settings</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              <button onClick={() => onSaveCashier(member.id, member.role === 'cashier' ? 'cashier' : 'cashier', cashierMethods)}
                disabled={saving === member.id+'_role'}
                className="btn-primary" style={{ width:'100%', justifyContent:'center' }}>
                {saving === member.id+'_role' ? 'Saving…' : 'Save Assigned Methods'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Committee tab ── */}
      {activeTab === 'committee' && features.committeeRoles && (
        <div>
          <div className="alert alert-info" style={{ marginBottom:16, fontSize:13 }}>
            Committee roles are for display only. They do not affect any access or permissions.
          </div>
          <div className="form-group">
            <label className="form-label">Committee Role</label>
            <input
              value={committeeEdit}
              onChange={e => setCommitteeEdit(e.target.value)}
              placeholder="e.g. President, Secretary…"
              list="committee-presets"
            />
            <datalist id="committee-presets">
              {COMMITTEE_PRESETS.map(p => <option key={p} value={p} />)}
            </datalist>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
              {COMMITTEE_PRESETS.map(p => (
                <button key={p} type="button" onClick={() => setCommitteeEdit(p)}
                  style={{ padding:'4px 10px', fontSize:11, borderRadius:99, border:`1px solid ${committeeEdit===p?'#2563eb':'#e2e8f0'}`, background: committeeEdit===p?'#eff6ff':'#fff', color: committeeEdit===p?'#2563eb':'#475569', cursor:'pointer', fontWeight: committeeEdit===p ? 600 : 400 }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            {committeeEdit && (
              <button onClick={() => { setCommitteeEdit(''); onSaveCommittee(member.id, ''); }}
                className="btn-ghost" style={{ padding:'10px 14px', fontSize:13 }}>
                Clear Role
              </button>
            )}
            <button onClick={() => onSaveCommittee(member.id, committeeEdit)}
              disabled={saving === member.id+'_committee'}
              className="btn-primary" style={{ flex:1, justifyContent:'center' }}>
              {saving === member.id+'_committee' ? 'Saving…' : 'Save Committee Role'}
            </button>
          </div>
        </div>
      )}
    </Modal>
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
  const features = orgData?.features || {};
  const limits   = orgData?.limits   || {};

  useEffect(() => {
    if (!orgId) return;
    const unsub = onSnapshot(collection(db, 'organizations', orgId, 'members'), async snap => {
      const docs   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const merged = await Promise.all(docs.map(async m => {
        try {
          const u = await getDoc(doc(db, 'users', m.id));
          return u.exists() ? { ...u.data(), ...m } : m;
        } catch { return m; }
      }));
      setMembers(merged);
      setSelected(s => s ? (merged.find(m => m.id === s.id) || null) : null);
    });
    return unsub;
  }, [orgId]);

  const nextMemberId = () => {
    const prefix = settings.memberIdPrefix || 'M';
    const nums   = members.map(m => m.idNo||'').filter(id => id.startsWith(prefix+'-')).map(id => parseInt(id.split('-')[1])||0);
    return `${prefix}-${String((nums.length ? Math.max(...nums) : 0)+1).padStart(3,'0')}`;
  };

  const toggleApproval = async m => {
    // Check max members limit when approving
    if (!m.approved && limits.maxMembers) {
      const approvedCount = members.filter(x => x.approved && x.id !== m.id).length;
      if (approvedCount >= limits.maxMembers) {
        alert(`Member limit reached (${limits.maxMembers}). Contact superadmin to increase the limit.`);
        return;
      }
    }
    setSaving(m.id);
    try {
      const nowApproved = !m.approved;
      const update      = { approved: nowApproved };
      if (nowApproved && settings.autoMemberId && !m.idNo) update.idNo = nextMemberId();
      await updateDoc(doc(db, 'organizations', orgId, 'members', m.id), update);
      const msg = nowApproved
        ? `✅ Your membership has been approved! Welcome to ${orgData?.name || 'the organization'}.`
        : `⚠️ Your membership has been suspended. Please contact admin for more details.`;
      await addDoc(collection(db, 'organizations', orgId, 'notifications'), {
        userId: m.id, message: msg, read: false, createdAt: serverTimestamp(),
      });
    } catch (e) { alert(e.message); }
    setSaving(null);
  };

  const saveId = async (uid, val) => {
    setSaving(uid+'_id');
    try { await updateDoc(doc(db, 'organizations', orgId, 'members', uid), { idNo: val }); }
    catch (e) { alert(e.message); }
    setSaving(null);
  };

  const saveCashier = async (uid, newRole, methods) => {
    setSaving(uid+'_role');
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'members', uid), {
        role: newRole,
        cashierMethods: methods,
      });
      const m = members.find(x => x.id === uid);
      if (m) {
        const msg = newRole === 'cashier'
          ? `💳 You have been assigned as a cashier for payment methods: ${methods.join(', ')||'none'}.`
          : `ℹ️ Your cashier role has been removed. You are now a regular member.`;
        await addDoc(collection(db, 'organizations', orgId, 'notifications'), {
          userId: uid, message: msg, read: false, createdAt: serverTimestamp(),
        });
      }
    } catch (e) { alert(e.message); }
    setSaving(null);
  };

  const saveCommittee = async (uid, role) => {
    setSaving(uid+'_committee');
    try { await updateDoc(doc(db, 'organizations', orgId, 'members', uid), { committeeRole: role }); }
    catch (e) { alert(e.message); }
    setSaving(null);
  };

  const filtered = members.filter(m => {
    const q  = search.toLowerCase();
    const sf = !search
      || (m.nameEnglish||'').toLowerCase().includes(q)
      || (m.phone||'').includes(search)
      || (m.email||'').toLowerCase().includes(q)
      || (m.idNo||'').includes(search);
    const ff = filter === 'all'
      || filter === m.role
      || (filter === 'approved' ? m.approved : filter === 'pending' ? !m.approved : false);
    return sf && ff;
  });

  const roleBadge = r => r === 'admin' ? 'badge-blue' : r === 'cashier' ? 'badge-yellow' : 'badge-gray';
  const cashierCount = members.filter(m => m.role === 'cashier').length;
  const adminCount   = members.filter(m => m.role === 'admin').length;

  const filterOptions = ['all','approved','pending','cashier'];

  return (
    <div className="page-wrap animate-fade">
      <div className="page-header" style={{ display:'flex', alignItems:'center', gap:14 }}>
        {orgData?.logoURL && (
          <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
            <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          </div>
        )}
        <div style={{ flex:1 }}>
          <div className="page-title">Members</div>
          <div className="page-subtitle" style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <span>{members.length} total · {members.filter(m => !m.approved).length} pending</span>
            {features.cashierRole && cashierCount > 0 && (
              <span className="badge badge-yellow" style={{ fontSize:10 }}>💳 {cashierCount} cashier{cashierCount>1?'s':''}</span>
            )}
            {settings.autoMemberId && (
              <span style={{ fontSize:11, background:'#eff6ff', color:'#2563eb', padding:'2px 8px', borderRadius:4, fontWeight:600 }}>Auto-ID</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, phone, ID…" style={{ flex:1, minWidth:160 }} />
        <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' }}>
          {filterOptions.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={filter === f ? 'btn-primary' : 'btn-ghost'}
              style={{ padding:'9px 14px', fontSize:12, textTransform:'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap"><div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Member</th><th>ID</th><th>Phone</th><th>Role</th>
              {features.committeeRoles && <th>Committee</th>}
              <th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={features.committeeRoles ? 7 : 6} style={{ textAlign:'center', color:'#94a3b8', padding:40 }}>No members found</td></tr>
            ) : filtered.map(m => (
              <tr key={m.id} onClick={() => setSelected(m)} style={{ cursor:'pointer' }}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Avatar m={m} size={34} />
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{m.nameEnglish || '(no name)'}</div>
                      {m.nameBengali && <div style={{ fontSize:11, color:'#94a3b8' }}>{m.nameBengali}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ fontSize:12, color:'#475569', fontFamily:'monospace' }}>{m.idNo || '—'}</td>
                <td style={{ fontSize:12, color:'#475569' }}>{m.phone || '—'}</td>
                <td>
                  <span className={`badge ${roleBadge(m.role)}`} style={{ fontSize:10, textTransform:'capitalize' }}>{m.role || 'member'}</span>
                  {m.role === 'cashier' && m.cashierMethods?.length > 0 && (
                    <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{m.cashierMethods.join(', ')}</div>
                  )}
                </td>
                {features.committeeRoles && (
                  <td style={{ fontSize:12, color:'#475569' }}>{m.committeeRole || '—'}</td>
                )}
                <td><span className={`badge ${m.approved ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize:10 }}>{m.approved ? 'Approved' : 'Pending'}</span></td>
                <td onClick={e => e.stopPropagation()}>
                  <button onClick={() => toggleApproval(m)} disabled={saving === m.id}
                    style={{ padding:'4px 12px', fontSize:11, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', whiteSpace:'nowrap',
                      background: m.approved ? '#fee2e2' : '#dcfce7',
                      color:      m.approved ? '#b91c1c' : '#15803d',
                      opacity: saving === m.id ? .6 : 1 }}>
                    {saving === m.id ? '…' : m.approved ? 'Suspend' : 'Approve'}
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
          onSaveCashier={saveCashier}
          onSaveCommittee={saveCommittee}
          settings={settings}
          nextId={nextMemberId()}
          saving={saving}
          orgData={orgData}
          members={members}
        />
      )}
    </div>
  );
}