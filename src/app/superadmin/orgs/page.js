'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const SHEET_STYLES = `
  .org-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.55);
    z-index: 9000;
    display: flex; align-items: flex-end; justify-content: center;
    padding-top: 56px;
  }
  .org-sheet {
    background: #fff; width: 100%;
    max-height: calc(100vh - 56px);
    overflow-y: auto; -webkit-overflow-scrolling: touch;
    border-radius: 20px 20px 0 0;
    animation: orgUp .25s cubic-bezier(.32,1,.32,1) both;
  }
  .org-handle { width:40px; height:4px; background:#e2e8f0; border-radius:99px; margin:12px auto 0; }
  .org-body { padding: 16px 20px 48px; }
  @keyframes orgUp { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
  @media (min-width: 769px) {
    .org-overlay { align-items: center; padding: 24px; }
    .org-sheet { max-width: 460px; max-height: 88vh; border-radius: 16px; animation: orgPop .2s ease both; }
    .org-handle { display: none; }
    .org-body { padding: 24px 28px 36px; }
  }
  @keyframes orgPop { from { transform:scale(.96) translateY(8px); opacity:0; } to { transform:scale(1) translateY(0); opacity:1; } }
  .err-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#b91c1c; color:#fff; padding:12px 20px; border-radius:10px; font-size:13px; font-weight:600; z-index:99999; max-width:90vw; text-align:center; box-shadow: 0 4px 20px rgba(0,0,0,0.25); animation: fadeUp .25s ease both; }
  .ok-toast  { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#15803d; color:#fff; padding:12px 20px; border-radius:10px; font-size:13px; font-weight:600; z-index:99999; max-width:90vw; text-align:center; box-shadow: 0 4px 20px rgba(0,0,0,0.25); animation: fadeUp .25s ease both; }
`;

function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return <div className={type === 'err' ? 'err-toast' : 'ok-toast'}>{msg}</div>;
}

function OrgModal({ org, counts, onClose, onSetStatus, saving }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const status = org.status || 'active';
  const Row = ({ l, v }) => (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'7px 0', borderBottom:'1px solid #f1f5f9' }}>
      <span style={{ color:'#64748b' }}>{l}</span>
      <span style={{ fontWeight:500 }}>{v || '—'}</span>
    </div>
  );

  return (
    <div className="org-overlay" onClick={onClose}>
      <div className="org-sheet" onClick={e => e.stopPropagation()}>
        <div className="org-handle" />
        <div className="org-body">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ fontWeight:700, fontSize:15 }}>Organization Details</span>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:24, color:'#94a3b8', lineHeight:1 }}>×</button>
          </div>

          <div style={{ textAlign:'center', marginBottom:16 }}>
            <div style={{ width:60, height:60, borderRadius:14, background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, color:'#1d4ed8', margin:'0 auto 10px', overflow:'hidden' }}>
              {org.logoURL ? <img src={org.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (org.name?.[0]||'?')}
            </div>
            <div style={{ fontWeight:700, fontSize:17 }}>{org.name}</div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{org.type}</div>
            <div style={{ marginTop:8 }}>
              <span className={`badge ${status==='active'?'badge-green':status==='pending'?'badge-yellow':'badge-red'}`} style={{ textTransform:'capitalize', fontSize:12 }}>
                {status === 'pending' ? '⏳ Pending Approval' : status}
              </span>
            </div>
          </div>

          {org.description && (
            <p style={{ fontSize:13, color:'#64748b', marginBottom:12, lineHeight:1.6, background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>{org.description}</p>
          )}

          <Row l="Members"        v={counts[org.id] ?? '…'} />
          <Row l="Monthly Amount" v={org.settings?.baseAmount ? `৳${org.settings.baseAmount.toLocaleString()}` : null} />
          <Row l="Currency"       v={org.currency || 'BDT'} />

          <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:10 }}>
            {status === 'pending' && (
              <button onClick={() => onSetStatus(org.id, 'active')} disabled={saving}
                style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'#dcfce7', color:'#15803d', cursor:'pointer', fontWeight:700, fontSize:15, opacity: saving ? 0.6 : 1 }}>
                {saving ? '…' : '✅ Approve Organization'}
              </button>
            )}
            {status === 'active' && (
              <button onClick={() => onSetStatus(org.id, 'suspended')} disabled={saving}
                style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'#fee2e2', color:'#b91c1c', cursor:'pointer', fontWeight:600, fontSize:14, opacity: saving ? 0.6 : 1 }}>
                {saving ? '…' : '🚫 Suspend Organization'}
              </button>
            )}
            {status === 'suspended' && (
              <>
                <button onClick={() => onSetStatus(org.id, 'active')} disabled={saving}
                  style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'#dcfce7', color:'#15803d', cursor:'pointer', fontWeight:700, fontSize:15, opacity: saving ? 0.6 : 1 }}>
                  {saving ? '…' : '✅ Reactivate Organization'}
                </button>
                <button onClick={() => onSetStatus(org.id, 'pending')} disabled={saving}
                  style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'#fffbeb', color:'#b45309', cursor:'pointer', fontWeight:600, fontSize:14, opacity: saving ? 0.6 : 1 }}>
                  {saving ? '…' : '⏸ Move to Pending'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminOrgs() {
  const { isSuperAdmin } = useAuth();
  const [orgs, setOrgs]       = useState([]);
  const [counts, setCounts]   = useState({});
  const [selected, setSelected] = useState(null);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsub = onSnapshot(collection(db, 'organizations'),
      async snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrgs(list);
        // Auto-update selected if open
        setSelected(prev => prev ? (list.find(o => o.id === prev.id) || null) : null);
        // Load member counts
        const c = { ...counts };
        await Promise.all(list.map(async o => {
          try { const s = await getDocs(collection(db, 'organizations', o.id, 'members')); c[o.id] = s.size; }
          catch { c[o.id] = '?'; }
        }));
        setCounts(c);
      },
      err => setToast({ msg: 'Failed to load organizations: ' + err.message, type: 'err' })
    );
    return unsub;
  }, [isSuperAdmin]);

  const setStatus = async (orgId, status) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'organizations', orgId), { status });
      setToast({ msg: `Organization ${status === 'active' ? 'approved' : status} successfully!`, type: 'ok' });
      setSelected(null);
    } catch (e) {
      setToast({ msg: 'Error: ' + e.message, type: 'err' });
    }
    setSaving(false);
  };

  const filtered = orgs.filter(o => {
    const ms = (o.name || '').toLowerCase().includes(search.toLowerCase());
    const mf = filter === 'all' || (o.status || 'active') === filter;
    return ms && mf;
  });

  if (!isSuperAdmin) return null;

  const pending = orgs.filter(o => o.status === 'pending').length;
  const active  = orgs.filter(o => (o.status || 'active') === 'active').length;

  return (
    <div className="page-wrap animate-fade">
      <style>{SHEET_STYLES}</style>

      <div className="page-header">
        <div style={{ fontSize:11, fontWeight:600, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Super Admin</div>
        <div className="page-title">Organizations</div>
        <div className="page-subtitle">{orgs.length} total · {active} active · {pending} pending</div>
      </div>

      {pending > 0 && (
        <div style={{ padding:'12px 16px', borderRadius:10, background:'#fffbeb', border:'1px solid #fcd34d', marginBottom:16, color:'#92400e', fontSize:13, fontWeight:500 }}>
          ⚠️ <strong>{pending} organization{pending > 1 ? 's' : ''}</strong> waiting for approval — tap a row to approve
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search organizations…" style={{ flex:1, minWidth:160 }} />
        <div style={{ display:'flex', gap:6 }}>
          {['all','active','pending','suspended'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={filter === f ? 'btn-primary' : 'btn-ghost'}
              style={{ padding:'9px 12px', fontSize:12, textTransform:'capitalize' }}>{f}</button>
          ))}
        </div>
      </div>

      <div className="table-wrap"><div className="table-scroll">
        <table>
          <thead>
            <tr><th>Organization</th><th>Type</th><th>Members</th><th>Monthly</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={5} style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>No organizations found</td></tr>
              : filtered.map(o => {
                const st = o.status || 'active';
                return (
                  <tr key={o.id} onClick={() => setSelected(o)} style={{ cursor:'pointer' }}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:9, background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#1d4ed8', fontSize:14, flexShrink:0, overflow:'hidden' }}>
                          {o.logoURL ? <img src={o.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (o.name?.[0] || '?')}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{o.name}</div>
                          <div style={{ fontSize:11, color:'#94a3b8' }}>{o.type || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{o.type || '—'}</td>
                    <td style={{ fontWeight:500 }}>{counts[o.id] ?? '…'}</td>
                    <td style={{ fontWeight:500 }}>৳{o.settings?.baseAmount?.toLocaleString() || '—'}</td>
                    <td>
                      <span className={`badge ${st==='active'?'badge-green':st==='pending'?'badge-yellow':'badge-red'}`} style={{ textTransform:'capitalize' }}>
                        {st === 'pending' ? '⏳ Pending' : st}
                      </span>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div></div>

      {selected && (
        <OrgModal
          org={selected}
          counts={counts}
          onClose={() => setSelected(null)}
          onSetStatus={setStatus}
          saving={saving}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
