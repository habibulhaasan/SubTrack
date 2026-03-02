'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

function getMonths(startDate) {
  if (!startDate) return [];
  const months = [];
  const start  = new Date(startDate);
  const now    = new Date();
  let d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= now) {
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    d.setMonth(d.getMonth()+1);
  }
  return months;
}

const initials = n => (n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

function MemberAvatar({ m, size=36 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:size*.34, color:'#1d4ed8', flexShrink:0, overflow:'hidden' }}>
      {m.photoURL ? <img src={m.photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : initials(m.nameEnglish)}
    </div>
  );
}

export default function AdminLedger() {
  const { userData, orgData } = useAuth();
  const [members, setMembers]       = useState([]);
  const [selMember, setSelMember]   = useState(null);
  const [ledger, setLedger]         = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);
  // Mobile navigation: 'list' shows members, 'detail' shows ledger
  const [mobileView, setMobileView] = useState('list');
  const orgId    = userData?.activeOrgId;
  const settings = orgData?.settings || {};

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const snap = await getDocs(collection(db,'organizations',orgId,'members'));
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      const merged = await Promise.all(docs.map(async m => {
        try { const u = await getDoc(doc(db,'users',m.id)); return u.exists() ? { ...m, ...u.data(), id:m.id } : m; }
        catch { return m; }
      }));
      merged.sort((a,b) => (a.nameEnglish||'').localeCompare(b.nameEnglish||''));
      setMembers(merged);
    })();
  }, [orgId]);

  const loadLedger = async m => {
    setSelMember(m);
    setMobileView('detail');
    setLoading(true);
    const allMonths = getMonths(settings.startDate);
    const snap = await getDocs(collection(db,'organizations',orgId,'investments'));
    const mine = snap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.userId===m.id);
    const verMap={}, pendMap={};
    mine.forEach(p => (p.paidMonths||[]).forEach(mo => {
      if (p.status==='verified') verMap[mo]=p;
      else if (p.status==='pending') pendMap[mo]=p;
    }));
    setLedger(allMonths.map(mo => ({
      month: mo,
      status: verMap[mo] ? 'verified' : pendMap[mo] ? 'pending' : 'due',
      amount: (verMap[mo]||pendMap[mo])?.amount,
      baseAmount: (() => {
        const rec = verMap[mo]||pendMap[mo];
        if (!rec) return undefined;
        return (rec.amount||0) - (rec.penaltyPaid||0) - (rec.gatewayFee||0);
      })(),
      penalty: (verMap[mo]||pendMap[mo])?.penaltyPaid,
      date: (verMap[mo]||pendMap[mo])?.createdAt,
    })));
    setLoading(false);
  };

  const filtered = members.filter(m =>
    !search ||
    (m.nameEnglish||'').toLowerCase().includes(search.toLowerCase()) ||
    (m.idNo||'').toLowerCase().includes(search.toLowerCase())
  );

  const stats = selMember ? {
    verified: ledger.filter(r=>r.status==='verified').length,
    pending:  ledger.filter(r=>r.status==='pending').length,
    due:      ledger.filter(r=>r.status==='due').length,
    totalPaid: ledger.filter(r=>r.status==='verified').reduce((s,r)=>s+((r.amount||0)-(r.penalty||0)),0),
  } : null;

  /* ── Member list panel ─────────────────────────────────────────── */
  const MemberList = () => (
    <div>
      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Search members…" style={{ marginBottom:12 }} />
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {filtered.map(m => (
          <button key={m.id} onClick={() => loadLedger(m)}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:10,
              border:`1.5px solid ${selMember?.id===m.id ? '#bfdbfe' : '#e2e8f0'}`,
              background: selMember?.id===m.id ? '#eff6ff' : '#fff',
              cursor:'pointer', textAlign:'left', width:'100%', transition:'all .15s' }}>
            <MemberAvatar m={m} size={36} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                color: selMember?.id===m.id ? '#1d4ed8' : '#0f172a' }}>{m.nameEnglish||'(no name)'}</div>
              <div style={{ fontSize:11, color:'#94a3b8' }}>{m.idNo||'No ID'}</div>
            </div>
            {!m.approved && <span className="badge badge-yellow" style={{ fontSize:10 }}>Pending</span>}
            <span style={{ color:'#cbd5e1', fontSize:18, lineHeight:1 }}>›</span>
          </button>
        ))}
        {filtered.length === 0 && <div style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>No members found</div>}
      </div>
    </div>
  );

  /* ── Ledger detail panel ───────────────────────────────────────── */
  const LedgerDetail = () => loading ? (
    <div className="card" style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>Loading…</div>
  ) : (
    <>
      {/* Member header */}
      <div className="card" style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12, padding:'14px 18px', flexWrap:'wrap' }}>
        <MemberAvatar m={selMember} size={46} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:16, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selMember.nameEnglish}</div>
          <div style={{ fontSize:12, color:'#64748b' }}>ID: {selMember.idNo||'—'} · Contribution: ৳{stats?.totalPaid?.toLocaleString()||0}</div>
        </div>
        {stats && (
          <div style={{ display:'flex', gap:20, flexShrink:0 }}>
            {[['Paid',stats.verified,'#16a34a'],['Pending',stats.pending,'#d97706'],['Due',stats.due,'#dc2626']].map(([l,v,c]) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800, color:c }}>{v}</div>
                <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em' }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger table */}
      <div className="table-wrap"><div className="table-scroll">
        <table>
          <thead>
            <tr><th>Month</th><th>Status</th><th>Amount</th><th>Late Fee</th><th>Date</th></tr>
          </thead>
          <tbody>
            {ledger.map(r => (
              <tr key={r.month}>
                <td style={{ fontFamily:'monospace', fontWeight:600, whiteSpace:'nowrap' }}>{r.month}</td>
                <td>
                  <span className={`badge ${r.status==='verified'?'badge-green':r.status==='pending'?'badge-yellow':'badge-red'}`}>
                    {r.status}
                  </span>
                </td>
                <td>{r.baseAmount != null ? `৳${r.baseAmount.toLocaleString()}` : <span style={{ color:'#94a3b8' }}>—</span>}</td>
                <td>{r.penalty ? <span style={{ color:'#d97706', fontWeight:500 }}>৳{r.penalty}</span> : <span style={{ color:'#94a3b8' }}>—</span>}</td>
                <td style={{ fontSize:12, color:'#94a3b8', whiteSpace:'nowrap' }}>
                  {r.date?.seconds ? new Date(r.date.seconds*1000).toLocaleDateString('en-GB') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </>
  );

  return (
    <div className="page-wrap animate-fade">
      <style>{`
        /* Mobile: show one panel at a time */
        @media (max-width: 767px) {
          .ledger-list-panel   { display: block; }
          .ledger-detail-panel { display: none; }
          .ledger-list-panel.hide  { display: none; }
          .ledger-detail-panel.show { display: block; }
          .back-btn { display: inline-flex; }
        }
        /* Desktop: show both side by side */
        @media (min-width: 768px) {
          .ledger-container { display: grid !important; grid-template-columns: 280px 1fr; gap: 16px; align-items: start; }
          .ledger-list-panel { display: block !important; }
          .ledger-detail-panel { display: block !important; }
          .back-btn { display: none !important; }
        }
      `}</style>

      <div className="page-header" style={{ display:'flex', alignItems:'center', gap:14 }}>
        {orgData?.logoURL && (
          <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
            <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          </div>
        )}
        <div>
          <div className="page-title">Member Ledger</div>
          <div className="page-subtitle">View payment history by member</div>
        </div>
      </div>

      {/* Mobile: back button when in detail view - always render, hide via CSS on desktop */}
      <style>{`.back-btn-wrap { display: none; } @media (max-width: 767px) { .back-btn-wrap { display: block; } }`}</style>
      {mobileView === 'detail' && (
        <div className="back-btn-wrap">
          <button onClick={() => setMobileView('list')}
            style={{ display:'inline-flex', alignItems:'center', gap:6, marginBottom:16, background:'none', border:'none', cursor:'pointer', color:'#2563eb', fontWeight:600, fontSize:14, padding:0 }}>
            ← All Members
          </button>
        </div>
      )}

      <div className="ledger-container" style={{ display:'block' }}>
        <div className={`ledger-list-panel${mobileView==='detail' ? ' hide' : ''}`}>
          <MemberList />
        </div>
        <div className={`ledger-detail-panel${mobileView==='detail' ? ' show' : ''}`}>
          {selMember ? <LedgerDetail /> : (
            /* Desktop placeholder — hidden on mobile */
            <div className="card" style={{ textAlign:'center', padding:'60px 20px', color:'#94a3b8' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>👈</div>
              <div style={{ fontWeight:500 }}>Select a member to view their ledger</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
