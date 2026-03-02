'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

export default function AdminVerify() {
  const {userData, orgData} = useAuth();
  const [payments, setPayments] = useState([]);
  const [members, setMembers]   = useState({});  // uid → merged profile
  const [filter, setFilter]     = useState('pending');
  const [search, setSearch]     = useState('');
  const [saving, setSaving]     = useState(null);
  const orgId = userData?.activeOrgId;

  useEffect(() => {
    if (!orgId) return;

    // Load payments realtime
    const unsub1 = onSnapshot(collection(db, 'organizations', orgId, 'investments'), snap => {
      setPayments(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      );
    });

    // Load member profiles realtime (merge subcollection + users collection)
    const unsub2 = onSnapshot(collection(db, 'organizations', orgId, 'members'), async snap => {
      const map = {};
      await Promise.all(snap.docs.map(async d => {
        const membership = d.data();
        try {
          const uSnap = await getDoc(doc(db, 'users', d.id));
          map[d.id] = uSnap.exists()
            ? { ...uSnap.data(), ...membership, uid: d.id }
            : { ...membership, uid: d.id };
        } catch { map[d.id] = { ...membership, uid: d.id }; }
      }));
      setMembers(map);
    });

    return () => { unsub1(); unsub2(); };
  }, [orgId]);

  const verify = async (payment, status) => {
    setSaving(payment.id);
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'investments', payment.id), {
        status, verifiedAt: serverTimestamp(),
      });
      // Send notification to the member
      const m = members[payment.userId];
      const name = m?.nameEnglish || 'Member';
      const months = (payment.paidMonths || []).join(', ') || 'your payment';
      const msg = status === 'verified'
        ? `✅ Your payment for ${months} has been verified. Amount: ৳${payment.amount?.toLocaleString()}`
        : `❌ Your payment for ${months} has been rejected. Please contact admin for details.`;
      await addDoc(collection(db, 'organizations', orgId, 'notifications'), {
        userId: payment.userId,
        message: msg,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) { alert(e.message); }
    setSaving(null);
  };

  const filtered = payments.filter(p => {
    const mf = filter === 'all' || p.status === filter;
    const m  = members[p.userId];
    const sf = !search ||
      (m?.nameEnglish || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.txId || '').toLowerCase().includes(search.toLowerCase());
    return mf && sf;
  });

  const counts = {
    pending:  payments.filter(p => p.status === 'pending').length,
    verified: payments.filter(p => p.status === 'verified').length,
  };

  return (
    <div className="page-wrap animate-fade">
      <div className="page-header" style={{ display:'flex', alignItems:'center', gap:14 }}>
        {orgData?.logoURL && (
          <div style={{ width:44, height:44, borderRadius:10, overflow:'hidden', flexShrink:0, border:'1px solid #e2e8f0' }}>
            <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          </div>
        )}
        <div className="page-header-content">
        <div className="page-title">Verify Payments</div>
        <div className="page-subtitle">{counts.pending} pending · {counts.verified} verified</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by member name or TxID…"
          style={{ flex:1, minWidth:200 }} />
        <div style={{ display:'flex', gap:8 }}>
          {['pending','verified','rejected','all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={filter === f ? 'btn-primary' : 'btn-ghost'}
              style={{ padding:'9px 14px', fontSize:13, textTransform:'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-scroll"><table>
          <thead>
            <tr>
              <th>Member</th><th>Months</th><th>Method</th>
              <th>TxID</th><th>Amount</th><th>Date</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>
                No records found
              </td></tr>
            ) : filtered.map(p => {
              const m = members[p.userId];
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight:600, fontSize:13 }}>{m?.nameEnglish || m?.nameBengali || <span style={{color:'#94a3b8',fontStyle:'italic'}}>Unknown</span>}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{m?.idNo || p.userId?.slice(0,8) || '—'}</div>
                  </td>
                  <td style={{ fontSize:11, maxWidth:120, color:'#475569' }}>
                    {(p.paidMonths || []).join(', ') || '—'}
                  </td>
                  <td style={{ fontSize:12 }}>{p.method}</td>
                  <td style={{ fontFamily:'monospace', fontSize:11, color:'#475569', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis' }}>
                    {p.txId || '—'}
                  </td>
                  <td style={{ fontWeight:600 }}>৳{p.amount?.toLocaleString()}</td>
                  <td style={{ whiteSpace:'nowrap', fontSize:12, color:'#64748b' }}>
                    {p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td>
                    <span className={`badge ${p.status==='verified'?'badge-green':p.status==='rejected'?'badge-red':'badge-yellow'}`}
                      style={{ textTransform:'capitalize' }}>{p.status}</span>
                  </td>
                  <td>
                    {p.status === 'pending' && (
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => verify(p, 'verified')} disabled={saving === p.id}
                          style={{ padding:'5px 12px', fontSize:12, borderRadius:6, border:'none', background:'#dcfce7', color:'#15803d', cursor:'pointer', fontWeight:600 }}>
                          {saving === p.id ? '…' : 'Verify'}
                        </button>
                        <button onClick={() => verify(p, 'rejected')} disabled={saving === p.id}
                          style={{ padding:'5px 12px', fontSize:12, borderRadius:6, border:'none', background:'#fee2e2', color:'#b91c1c', cursor:'pointer', fontWeight:600 }}>
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
