// src/app/cashier/transfer/page.js  — Cashier fund transfer log
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, addDoc, getDocs, getDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/Modal';

const fmt = n => `৳${(n||0).toLocaleString(undefined,{maximumFractionDigits:0})}`;

export default function CashierTransfer() {
  const { user, userData, orgData, isOrgAdmin, isCashier, membership } = useAuth();
  const orgId = userData?.activeOrgId;

  const [transfers,  setTransfers]  = useState([]);
  const [cashiers,   setCashiers]   = useState([]);  // other cashiers + admins
  const [members,    setMembers]    = useState({});  // uid → profile
  const [modal,      setModal]      = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    toUserId: '',
    amount: '',
    method: '',
    txId: '',
    fee: '',
    feeNotes: '',
    notes: '',
  });

  const cashierMethods = membership?.cashierMethods || [];
  const myUid = user?.uid;

  // Load transfers (for this cashier or all if admin)
  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'organizations', orgId, 'cashierTransfers'), orderBy('createdAt','desc'));
    return onSnapshot(q, snap => {
      let all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Cashier only sees their own transfers
      if (isCashier && !isOrgAdmin) {
        all = all.filter(t => t.fromUserId === myUid || t.toUserId === myUid);
      }
      setTransfers(all);
    });
  }, [orgId, isCashier, isOrgAdmin, myUid]);

  // Load member profiles and cashier list
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const snap = await getDocs(collection(db, 'organizations', orgId, 'members'));
      const map  = {};
      const cashierList = [];
      await Promise.all(snap.docs.map(async d => {
        const mem = d.data();
        let profile = mem;
        try {
          const uSnap = await getDoc(doc(db, 'users', d.id));
          if (uSnap.exists()) profile = { ...uSnap.data(), ...mem, id: d.id };
          else profile = { ...mem, id: d.id };
        } catch { profile = { ...mem, id: d.id }; }
        map[d.id] = profile;
        // Eligible recipients: other cashiers + admins (not self)
        if (d.id !== myUid && (mem.role === 'cashier' || mem.role === 'admin') && mem.approved) {
          cashierList.push(profile);
        }
      }));
      setMembers(map);
      setCashiers(cashierList.sort((a,b) => (a.nameEnglish||'').localeCompare(b.nameEnglish||'')));
    })();
  }, [orgId, myUid]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.toUserId || !form.amount || !form.method) {
      alert('Recipient, amount, and method are required.');
      return;
    }
    const amount = Number(form.amount);
    const fee    = form.fee ? Number(form.fee) : 0;
    if (!amount || amount <= 0) { alert('Enter a valid amount.'); return; }
    setSubmitting(true);
    try {
      // Record the transfer
      await addDoc(collection(db, 'organizations', orgId, 'cashierTransfers'), {
        fromUserId:  myUid,
        toUserId:    form.toUserId,
        amount,
        method:      form.method,
        txId:        form.txId.trim(),
        fee,
        feeNotes:    form.feeNotes.trim(),
        notes:       form.notes.trim(),
        createdAt:   serverTimestamp(),
      });

      // If there's a fee, record it as an expense automatically
      if (fee > 0) {
        await addDoc(collection(db, 'organizations', orgId, 'expenses'), {
          title:    `Transfer fee${form.feeNotes ? ': ' + form.feeNotes : ''}`,
          amount:   fee,
          category: 'Operations',
          date:     new Date().toISOString().slice(0,10),
          notes:    `Auto-recorded from cashier transfer (${form.method})`,
          createdAt: serverTimestamp(),
          createdBy: myUid,
        });
      }

      // Notify recipient
      const toProfile = members[form.toUserId];
      const fromName  = members[myUid]?.nameEnglish || 'A cashier';
      await addDoc(collection(db, 'organizations', orgId, 'notifications'), {
        userId:    form.toUserId,
        message:   `💸 Fund transfer from ${fromName}: ${fmt(amount)} via ${form.method}.${fee ? ` Fee: ${fmt(fee)}.` : ''}${form.notes ? ' Note: ' + form.notes : ''}`,
        read:      false,
        createdAt: serverTimestamp(),
      });

      setForm({ toUserId:'', amount:'', method:'', txId:'', fee:'', feeNotes:'', notes:'' });
      setModal(false);
    } catch (err) { alert(err.message); }
    setSubmitting(false);
  };

  // Stats
  const sentTotal     = transfers.filter(t => t.fromUserId===myUid).reduce((s,t) => s+t.amount, 0);
  const receivedTotal = transfers.filter(t => t.toUserId===myUid).reduce((s,t) => s+t.amount, 0);
  const allTotal      = transfers.reduce((s,t) => s+t.amount, 0);
  const totalFees     = transfers.reduce((s,t) => s+(t.fee||0), 0);

  const getName = uid => members[uid]?.nameEnglish || uid?.slice(0,8) || '—';

  return (
    <div className="page-wrap animate-fade">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {orgData?.logoURL && (
            <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
              <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
            </div>
          )}
          <div>
            <div className="page-title">Fund Transfers</div>
            <div className="page-subtitle">
              {isCashier && !isOrgAdmin ? 'Track transfers you send or receive' : 'All cashier transfers in this organization'}
            </div>
          </div>
        </div>
        {(isCashier || isOrgAdmin) && (
          <button onClick={() => setModal(true)} className="btn-primary">+ New Transfer</button>
        )}
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', marginBottom:20 }}>
        {isCashier && !isOrgAdmin ? (
          <>
            <div className="stat-card"><div className="stat-label">Sent</div><div className="stat-value" style={{color:'#dc2626'}}>{fmt(sentTotal)}</div></div>
            <div className="stat-card"><div className="stat-label">Received</div><div className="stat-value" style={{color:'#16a34a'}}>{fmt(receivedTotal)}</div></div>
            <div className="stat-card"><div className="stat-label">Net</div><div className="stat-value" style={{color:'#2563eb'}}>{fmt(receivedTotal-sentTotal)}</div></div>
          </>
        ) : (
          <>
            <div className="stat-card"><div className="stat-label">Total Transferred</div><div className="stat-value" style={{color:'#2563eb'}}>{fmt(allTotal)}</div></div>
            <div className="stat-card"><div className="stat-label">Total Fees</div><div className="stat-value" style={{color:'#dc2626'}}>{fmt(totalFees)}</div></div>
            <div className="stat-card"><div className="stat-label">Transfers</div><div className="stat-value">{transfers.length}</div></div>
          </>
        )}
      </div>

      {/* Table */}
      {transfers.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}>
          No transfers recorded yet.
        </div>
      ) : (
        <div className="table-wrap"><div className="table-scroll">
          <table>
            <thead>
              <tr><th>Date</th><th>From</th><th>To</th><th>Method</th><th>Tx ID</th><th>Amount</th><th>Fee</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id}>
                  <td style={{ whiteSpace:'nowrap', fontSize:12, color:'#64748b' }}>
                    {t.createdAt?.seconds ? new Date(t.createdAt.seconds*1000).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td>
                    <div style={{ fontWeight:600, fontSize:13, color: t.fromUserId===myUid ? '#2563eb' : '#0f172a' }}>
                      {getName(t.fromUserId)}{t.fromUserId===myUid && <span style={{fontSize:10,color:'#94a3b8',marginLeft:4}}>(you)</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight:600, fontSize:13, color: t.toUserId===myUid ? '#16a34a' : '#0f172a' }}>
                      {getName(t.toUserId)}{t.toUserId===myUid && <span style={{fontSize:10,color:'#94a3b8',marginLeft:4}}>(you)</span>}
                    </div>
                  </td>
                  <td style={{ fontSize:12 }}>{t.method}</td>
                  <td style={{ fontFamily:'monospace', fontSize:11, color:'#475569' }}>{t.txId||'—'}</td>
                  <td style={{ fontWeight:700, color:'#0f172a' }}>{fmt(t.amount)}</td>
                  <td style={{ fontSize:12, color: t.fee ? '#dc2626' : '#94a3b8' }}>
                    {t.fee ? fmt(t.fee) : '—'}
                    {t.feeNotes && <div style={{ fontSize:10, color:'#94a3b8' }}>{t.feeNotes}</div>}
                  </td>
                  <td style={{ fontSize:12, color:'#64748b', maxWidth:140 }}>{t.notes||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {/* New Transfer Modal */}
      {modal && (
        <Modal title="Record Fund Transfer" onClose={() => setModal(false)}>
          <div className="alert alert-info" style={{ fontSize:13, marginBottom:16 }}>
            Record when you hand over collected funds to another cashier or admin. Any fee will automatically be logged as an expense.
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Transfer To *</label>
              <select value={form.toUserId} onChange={e => set('toUserId', e.target.value)} required>
                <option value="">Select recipient…</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nameEnglish || c.id.slice(0,8)} ({c.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input type="number" min="1" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" required />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method *</label>
                <select value={form.method} onChange={e => set('method', e.target.value)} required>
                  <option value="">Select…</option>
                  {(cashierMethods.length > 0 ? cashierMethods : ['bKash','Nagad','Rocket','Bank Transfer','Cash']).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Transaction ID / Reference</label>
              <input value={form.txId} onChange={e => set('txId', e.target.value)} placeholder="Optional reference number" />
            </div>

            <div style={{ padding:'12px 14px', background:'#fffbeb', border:'1px solid #fed7aa', borderRadius:8, marginBottom:16 }}>
              <div style={{ fontWeight:600, fontSize:13, color:'#92400e', marginBottom:8 }}>Transfer Fee (Optional)</div>
              <div className="form-row">
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Fee Amount</label>
                  <input type="number" min="0" value={form.fee} onChange={e => set('fee', e.target.value)} placeholder="0" />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Fee Description</label>
                  <input value={form.feeNotes} onChange={e => set('feeNotes', e.target.value)} placeholder="e.g. bKash charge" />
                </div>
              </div>
              {form.fee && Number(form.fee) > 0 && (
                <div style={{ fontSize:11, color:'#92400e', marginTop:8 }}>
                  ⚠️ ৳{Number(form.fee).toLocaleString()} will be automatically recorded as an expense.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Any additional context…" style={{ resize:'vertical' }} />
            </div>

            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <button type="button" onClick={() => setModal(false)} className="btn-ghost" style={{ flex:1, justifyContent:'center' }}>Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary" style={{ flex:2, justifyContent:'center' }}>
                {submitting ? 'Recording…' : 'Record Transfer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}