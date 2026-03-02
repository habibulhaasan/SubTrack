'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const STATUS = { verified:['badge-green','Verified'], pending:['badge-yellow','Pending'], rejected:['badge-red','Rejected'] };

export default function Ledger() {
  const {user, userData, orgData} = useAuth();
  const [records, setRecords] = useState([]);
  const [filter, setFilter]   = useState('all');
  const orgId = userData?.activeOrgId;

  useEffect(() => {
    if (!user || !orgId) return;
    const q = query(collection(db,'organizations',orgId,'investments'), where('userId','==',user.uid), orderBy('createdAt','desc'));
    return onSnapshot(q, snap => setRecords(snap.docs.map(d => ({id:d.id,...d.data()}))));
  }, [user, orgId]);

  const filtered = filter === 'all' ? records : records.filter(r => r.status === filter);
  const totalPaid = records.filter(r => r.status==='verified').reduce((s,r) => s+((r.amount||0)-(r.penaltyPaid||0)), 0);

  return (
    <div className="page-wrap animate-fade">
      <div className="page-header" style={{ display:'flex', alignItems:'center', gap:14 }}>
        {orgData?.logoURL && (
          <div style={{ width:44, height:44, borderRadius:10, overflow:'hidden', flexShrink:0, border:'1px solid #e2e8f0' }}>
            <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          </div>
        )}
        <div className="page-header-content">
        <div className="page-title">My Ledger</div>
        <div className="page-subtitle">My contribution: ৳{totalPaid.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {['all','verified','pending','rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={filter===f ? 'btn-primary' : 'btn-ghost'}
            style={{ padding:'7px 16px', fontSize:13, textTransform:'capitalize' }}>{f}</button>
        ))}
      </div>

      <div className="table-wrap"><div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Months</th>
              <th>Method</th>
              <th>TxID</th>
              <th>Amount</th>
              <th>Penalty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>No records found</td></tr>
            ) : filtered.map(r => {
              const [cls, label] = STATUS[r.status] || ['badge-gray','—'];
              return (
                <tr key={r.id}>
                  <td style={{ whiteSpace:'nowrap' }}>{r.createdAt?.seconds ? new Date(r.createdAt.seconds*1000).toLocaleDateString('en-GB') : '—'}</td>
                  <td style={{ fontSize:12 }}>{(r.paidMonths||[]).join(', ') || '—'}</td>
                  <td>{r.method}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.txId || '—'}</td>
                  <td style={{ fontWeight:600 }}>৳{r.amount?.toLocaleString()}</td>
                  <td>{r.penaltyPaid > 0 ? `৳${r.penaltyPaid}` : '—'}</td>
                  <td><span className={`badge ${cls}`}>{label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}
