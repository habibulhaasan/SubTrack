// src/app/admin/expenses/page.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, orderBy, query, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/Modal';

const CATS  = ['Operations','Event','Maintenance','Charity','Salary','Utilities','Other'];
const EMPTY = { title:'', amount:'', date:'', category:'', notes:'' };

export default function AdminExpenses() {
  const { userData, orgData } = useAuth();
  const [items, setItems]           = useState([]);
  const [totalFund, setTotalFund]   = useState(0);
  const [form, setForm]             = useState(EMPTY);
  const [modal, setModal]           = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const orgId = userData?.activeOrgId;
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db,'organizations',orgId,'expenses'), orderBy('date','desc'));
    const unsub = onSnapshot(q, snap => setItems(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
    getDocs(collection(db,'organizations',orgId,'investments')).then(snap => {
      setTotalFund(snap.docs.filter(d=>d.data().status==='verified').reduce((s,d)=>s+(d.data().amount||0),0));
    });
    return unsub;
  }, [orgId]);

  const totalSpent = items.reduce((s,i) => s+(i.amount||0), 0);
  const available  = totalFund - totalSpent;
  const isEdit     = modal && modal !== 'add';

  const notifyAll = async (message) => {
    if (!orgId) return;
    try {
      const mSnap = await getDocs(collection(db, 'organizations', orgId, 'members'));
      await Promise.all(mSnap.docs.filter(d=>d.data().approved).map(d =>
        addDoc(collection(db, 'organizations', orgId, 'notifications'), {
          userId: d.id, message, read: false, createdAt: serverTimestamp(),
        })
      ));
    } catch(e) { console.error('Notification error:', e); }
  };

  const openAdd    = () => { setForm({...EMPTY, date:new Date().toISOString().slice(0,10)}); setError(''); setModal('add'); };
  const openView   = item => { setForm({ title:item.title, amount:item.amount, date:item.date||'', category:item.category||'', notes:item.notes||'' }); setError(''); setModal(item); };
  const closeModal = useCallback(() => setModal(null), []);

  const handleSave = async e => {
    e.preventDefault(); setError('');
    const amt = Number(form.amount);
    if (!form.title || !amt) { setError('Title and amount are required.'); return; }
    if (!isEdit && amt > available) { setError(`Exceeds available funds (৳${available.toLocaleString()})`); return; }
    setSubmitting(true);
    try {
      if (!isEdit) {
        await addDoc(collection(db,'organizations',orgId,'expenses'), { ...form, amount:amt, createdAt:serverTimestamp() });
        await notifyAll(`💸 New expense recorded: "${form.title}" — ৳${amt.toLocaleString()}${form.category ? ` (${form.category})` : ''}`);
      } else {
        await updateDoc(doc(db,'organizations',orgId,'expenses',modal.id), { title:form.title, amount:amt, date:form.date, category:form.category, notes:form.notes });
      }
      setModal(null);
    } catch(err) { setError(err.message); }
    setSubmitting(false);
  };

  const handleDelete = async id => {
    if (!confirm('Delete this expense?')) return;
    await deleteDoc(doc(db,'organizations',orgId,'expenses',id));
    setModal(null);
  };

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
            <div className="page-title">Expenses</div>
            <div className="page-subtitle">Total spent: ৳{totalSpent.toLocaleString()}</div>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Add Expense</button>
      </div>

      <div className="stats-row">
        {[
          ['Total Fund',  `৳${totalFund.toLocaleString()}`,  '#0f172a'],
          ['Total Spent', `৳${totalSpent.toLocaleString()}`, '#dc2626'],
          ['Available',   `৳${available.toLocaleString()}`,  available >= 0 ? '#16a34a' : '#dc2626'],
        ].map(([l,v,c]) => (
          <div key={l} className="stat-card">
            <div className="stat-label">{l}</div>
            <div className="stat-value" style={{ color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {items.length === 0
        ? <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}>No expenses yet. Click "+ Add Expense" to record one.</div>
        : <div className="table-wrap"><div className="table-scroll">
            <table>
              <thead>
                <tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} onClick={() => openView(item)}>
                    <td style={{ fontSize:12, color:'#64748b', whiteSpace:'nowrap' }}>{item.date||'—'}</td>
                    <td style={{ fontWeight:500 }}>{item.title}</td>
                    <td>{item.category ? <span className="badge badge-gray">{item.category}</span> : '—'}</td>
                    <td style={{ fontWeight:600, color:'#dc2626' }}>৳{item.amount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
      }

      {modal && (
        <Modal title={!isEdit ? 'Add Expense' : 'Edit Expense'} onClose={closeModal}>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="What was this expense for?" required />
            </div>
            <div className="form-group">
              <label className="form-label">
                Amount *
                {!isEdit && <span style={{ fontWeight:400, textTransform:'none', color:'#94a3b8', fontSize:10, marginLeft:6 }}>Available: ৳{available.toLocaleString()}</span>}
              </label>
              <input type="number" min="1" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0" required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" value={form.date} onChange={e=>set('date',e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select value={form.category} onChange={e=>set('category',e.target.value)}>
                  <option value="">Select…</option>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Optional details" style={{ resize:'vertical' }} />
            </div>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              {isEdit && <button type="button" onClick={() => handleDelete(modal.id)} className="btn-danger">Delete</button>}
              <button type="submit" disabled={submitting} className="btn-primary" style={{ flex:1, justifyContent:'center' }}>
                {submitting ? 'Saving…' : !isEdit ? 'Add Expense' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}