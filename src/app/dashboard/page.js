'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const Stat = ({ label, value, sub, blue }) => (
  <div style={{ background: blue ? '#2563eb' : '#fff', border: '1px solid', borderColor: blue ? '#2563eb' : '#e2e8f0', borderRadius:12, padding:'18px 20px' }}>
    <div style={{ fontSize:11, fontWeight:600, color: blue ? 'rgba(255,255,255,0.75)' : '#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:22, fontWeight:700, color: blue ? '#fff' : '#0f172a' }}>{value}</div>
    {sub && <div style={{ fontSize:12, color: blue ? 'rgba(255,255,255,0.65)' : '#94a3b8', marginTop:2 }}>{sub}</div>}
  </div>
);

const STATUS_BADGE = { verified:['badge-green','Verified'], pending:['badge-yellow','Pending'], rejected:['badge-red','Rejected'] };

export default function Dashboard() {
  const { user, userData, orgData } = useAuth();
  const [totals, setTotals]         = useState({ fund:0, expenses:0, profit:0 });
  const [myStats, setMyStats]       = useState({ paid:0, pending:0, months:0 });
  const [recent, setRecent]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const orgId   = userData?.activeOrgId;
  const settings = orgData?.settings || {};
  const curr    = orgData?.currency || 'BDT';

  useEffect(() => {
    if (!user || !orgId) return;
    const u1 = onSnapshot(collection(db, 'organizations', orgId, 'investments'), snap => {
      const v = snap.docs.filter(d => d.data().status==='verified');
      setTotals(p => ({...p, fund: v.reduce((s,d) => s+(d.data().amount||0), 0)}));
    });
    const u2 = onSnapshot(collection(db, 'organizations', orgId, 'expenses'), snap => {
      setTotals(p => ({...p, expenses: snap.docs.reduce((s,d) => s+(d.data().amount||0), 0)}));
    });
    const u3 = onSnapshot(collection(db, 'organizations', orgId, 'deployments'), snap => {
      const m = snap.docs.filter(d => d.data().status==='matured');
      setTotals(p => ({...p, profit: m.reduce((s,d) => s+(d.data().profitGenerated||0), 0)}));
    });
    const q = query(collection(db, 'organizations', orgId, 'investments'), where('userId','==',user.uid), orderBy('createdAt','desc'));
    const u4 = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({id:d.id,...d.data()}));
      const v = docs.filter(d => d.status==='verified');
      const p = docs.filter(d => d.status==='pending');
      const months = new Set(v.flatMap(d => d.paidMonths||[]));
      setMyStats({ paid: v.reduce((s,d)=>s+((d.amount||0)-(d.penaltyPaid||0)),0), pending: p.reduce((s,d)=>s+(d.amount||0),0), months: months.size });
      setRecent(docs.slice(0,5));
      setLoading(false);
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [user, orgId]);

  // Installment progress
  const cycles = (() => {
    if (!settings.startDate) return { total:0, paid:myStats.months };
    const start = new Date(settings.startDate);
    const now = new Date();
    let n = 0;
    let d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= now) { n++; d.setMonth(d.getMonth()+1); }
    return { total: n, paid: myStats.months, pct: n>0 ? Math.round((myStats.months/n)*100) : 0 };
  })();

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading…</div>;

  return (
    <div className="page-wrap animate-fade">
      <div className="page-header" style={{ display:'flex', alignItems:'center', gap:14 }}>
        {orgData?.logoURL && (
          <div style={{ width:48, height:48, borderRadius:12, overflow:'hidden', flexShrink:0, border:'1px solid #e2e8f0' }}>
            <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          </div>
        )}
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">{orgData?.name} · Welcome back, {userData?.nameEnglish?.split(' ')[0]}</div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:24 }}>
        <Stat label="My Contributions"  value={`৳${myStats.paid.toLocaleString()}`}    sub={`${myStats.months} months paid`} blue />
        {settings.showFund !== false && (
          <Stat label="Total Fund"      value={`৳${totals.fund.toLocaleString()}`}      sub="All verified payments" />
        )}
        <Stat label="Net Profit"        value={`৳${totals.profit.toLocaleString()}`}    sub="From investments" />
        <Stat label="Expenses"          value={`৳${totals.expenses.toLocaleString()}`}  sub="Total spent" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16 }}>
        {/* Progress */}
        <div className="card">
          <div style={{ fontSize:14, fontWeight:600, color:'#0f172a', marginBottom:16 }}>Installment Progress</div>
          {cycles.total > 0 ? (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8 }}>
                <span style={{ color:'#64748b' }}>{cycles.paid} of {cycles.total} months</span>
                <span style={{ fontWeight:600, color:'#2563eb' }}>{cycles.pct}%</span>
              </div>
              <div style={{ height:8, background:'#e2e8f0', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${cycles.pct}%`, background:'#2563eb', borderRadius:99, transition:'width 0.5s' }} />
              </div>
              {myStats.pending > 0 && (
                <div className="alert alert-yellow" style={{ marginTop:14, fontSize:12, background:'#fffbeb', border:'1px solid #fed7aa', color:'#92400e', borderRadius:8, padding:'8px 12px' }}>
                  ৳{myStats.pending.toLocaleString()} pending verification
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize:13, color:'#94a3b8' }}>No installment data yet.</p>
          )}
          <div style={{ marginTop:16 }}>
            <Link href="/installment" className="btn-primary" style={{ fontSize:13, padding:'8px 16px', textDecoration:'none', display:'inline-flex' }}>Pay Now</Link>
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <div style={{ fontSize:14, fontWeight:600, color:'#0f172a', marginBottom:16 }}>Recent Payments</div>
          {recent.length === 0 ? (
            <p style={{ fontSize:13, color:'#94a3b8' }}>No payments yet.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {recent.map(r => {
                const [cls, label] = STATUS_BADGE[r.status] || ['badge-gray','Unknown'];
                return (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'#f8fafc', borderRadius:8 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#0f172a' }}>৳{r.amount?.toLocaleString()}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{r.method} · {r.createdAt?.seconds ? new Date(r.createdAt.seconds*1000).toLocaleDateString('en-GB') : '—'}</div>
                    </div>
                    <span className={`badge ${cls}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
