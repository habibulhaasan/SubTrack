'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, onSnapshot, serverTimestamp, query, where } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_METHODS = ['bKash','Nagad','Rocket','Bank Transfer','Cash'];

function getMonths(startDate) {
  if (!startDate) return [];
  const months = [];
  const start  = new Date(startDate);
  const now    = new Date();
  let d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= now) {
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

export default function Installment() {
  const { user, userData, orgData, membership } = useAuth();
  const [paidMonths, setPaidMonths]     = useState(new Set());
  const [paidSpecial, setPaidSpecial]   = useState(new Set()); // set of special sub IDs paid
  const [specialSubs, setSpecialSubs]   = useState([]);
  const [selected, setSelected]         = useState([]);
  const [selectedSpecial, setSelectedSpecial] = useState(null); // one special sub at a time
  const [method, setMethod]             = useState('');
  const [txId, setTxId]                 = useState('');
  const [loading, setLoading]           = useState(false);
  const [success, setSuccess]           = useState(false);
  const orgId    = userData?.activeOrgId;
  const settings = orgData?.settings || {};

  const monthlyEnabled = settings.monthlyEnabled !== false; // default true
  const enabledMethods = settings.paymentMethods || DEFAULT_METHODS;
  const accountDetails = settings.accountDetails || {};

  const getGatewayFee = (m) => {
    const cfg = settings.gatewayFees?.[m];
    if (cfg?.enabled && cfg?.rate) return Number(cfg.rate) / 100;
    return 0;
  };

  const baseAmount = (settings.uniformAmount === false && membership?.customAmount != null)
    ? membership.customAmount : (settings.baseAmount || 0);

  useEffect(() => {
    if (enabledMethods.length > 0 && !method) setMethod(enabledMethods[0]);
  }, [enabledMethods.join(',')]);

  // Load paid months
  useEffect(() => {
    if (!user || !orgId) return;
    const q = query(collection(db,'organizations',orgId,'investments'), where('userId','==',user.uid));
    getDocs(q).then(snap => {
      const paid = new Set();
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.status !== 'rejected') (data.paidMonths || []).forEach(m => paid.add(m));
      });
      setPaidMonths(paid);
      // also collect paid special sub IDs
      const pSpec = new Set();
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.specialSubId && data.status !== 'rejected') pSpec.add(data.specialSubId);
      });
      setPaidSpecial(pSpec);
    });
  }, [user, orgId]);

  // Load active special subscriptions
  useEffect(() => {
    if (!orgId) return;
    const unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'specialSubscriptions'),
      snap => {
        const now = new Date();
        setSpecialSubs(
          snap.docs.map(d => ({ id:d.id, ...d.data() }))
            .filter(s => s.active && s.deadline && new Date(s.deadline) >= now)
            .sort((a,b) => a.deadline.localeCompare(b.deadline))
        );
      }
    );
    return unsub;
  }, [orgId]);

  const allMonths    = getMonths(settings.startDate);
  const unpaidMonths = allMonths.filter(m => !paidMonths.has(m));
  const dueDay       = settings.dueDate || 10;
  const penalty      = settings.lateFeeEnabled ? (settings.penalty || 0) : 0;

  const isLate = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return new Date() > new Date(y, mo - 1, dueDay);
  };

  const toggle = (m) => setSelected(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);

  // Payment mode: 'monthly' | 'special'
  const [payMode, setPayMode] = useState(monthlyEnabled ? 'monthly' : 'special');

  // Compute totals
  const isSpecialMode = payMode === 'special' && selectedSpecial;
  const totalBase    = isSpecialMode ? (selectedSpecial?.amount || 0) : selected.length * baseAmount;
  const totalPenalty = isSpecialMode ? 0 : selected.filter(m => isLate(m)).length * penalty;
  const feeRate      = getGatewayFee(method);
  const fee          = Math.round((totalBase + totalPenalty) * feeRate);
  const grandTotal   = totalBase + totalPenalty + fee;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (payMode === 'monthly' && !selected.length) { alert('Please select at least one month.'); return; }
    if (payMode === 'special' && !selectedSpecial)  { alert('Please select a special subscription.'); return; }
    if (!method) { alert('Please select a payment method.'); return; }
    if (method !== 'Cash' && !txId.trim()) { alert('Please enter the Transaction ID.'); return; }
    setLoading(true);
    try {
      const payload = {
        userId:      user.uid,
        amount:      grandTotal,
        method,
        txId:        txId.trim(),
        status:      'pending',
        createdAt:   serverTimestamp(),
      };
      if (payMode === 'monthly') {
        payload.paidMonths  = selected;
        payload.baseAmount  = totalBase;
        payload.penaltyPaid = totalPenalty;
        payload.gatewayFee  = fee;
      } else {
        payload.specialSubId    = selectedSpecial.id;
        payload.specialSubTitle = selectedSpecial.title;
        payload.baseAmount      = selectedSpecial.amount;
        payload.gatewayFee      = fee;
        payload.paidMonths      = [];
      }
      await addDoc(collection(db,'organizations',orgId,'investments'), payload);
      setSuccess(true);
      setSelected([]);
      setSelectedSpecial(null);
      setTxId('');
    } catch (err) { alert('Error: ' + err.message); }
    setLoading(false);
  };

  if (success) return (
    <div style={{ padding:24, maxWidth:500, margin:'40px auto', textAlign:'center' }}>
      <div className="card">
        <div className="alert alert-success" style={{ fontSize:15, fontWeight:600 }}>
          ✓ Payment submitted — awaiting admin verification
        </div>
        <p style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>
          Your payment has been recorded. An admin will verify it shortly.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={() => setSuccess(false)} className="btn-primary">Pay Again</button>
          <a href="/ledger" className="btn-ghost" style={{ textDecoration:'none' }}>View My Ledger</a>
        </div>
      </div>
    </div>
  );

  const hasAnything = monthlyEnabled || specialSubs.length > 0;

  return (
    <div className="page-wrap animate-fade" style={{ maxWidth:760 }}>
      <div className="page-header" style={{ display:'flex', alignItems:'center', gap:14 }}>
        {orgData?.logoURL && (
          <div style={{ width:44, height:44, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
            <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          </div>
        )}
        <div>
          <div className="page-title">Pay Installment</div>
          <div className="page-subtitle">{orgData?.name}{monthlyEnabled ? ` · Monthly: ৳${baseAmount.toLocaleString()}` : ''}</div>
        </div>
      </div>

      {!hasAnything && (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⏸️</div>
          <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:4 }}>Payments paused</div>
          <div style={{ fontSize:13 }}>Monthly installments are currently disabled. Check back later.</div>
        </div>
      )}

      {hasAnything && (
        <form onSubmit={handleSubmit} style={{ display:'grid', gap:16 }}>
          {/* Payment accounts info */}
          {Object.keys(accountDetails).length > 0 && (
            <div className="card" style={{ background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
              <div style={{ fontWeight:600, fontSize:13, color:'#15803d', marginBottom:10 }}>
                📋 Send your payment to one of these accounts:
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {enabledMethods.filter(m => m !== 'Cash' && accountDetails[m]).map(m => (
                  <div key={m} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#fff', borderRadius:8, border:'1px solid #bbf7d0' }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'#475569', minWidth:110 }}>{m}</span>
                    <span style={{ fontFamily:'monospace', fontSize:14, fontWeight:700, color:'#0f172a' }}>{accountDetails[m]}</span>
                  </div>
                ))}
                {enabledMethods.includes('Cash') && (
                  <div style={{ fontSize:12, color:'#15803d', padding:'4px 12px' }}>
                    💵 Cash — pay directly to your organization admin
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mode switcher — only show if BOTH monthly and special exist */}
          {monthlyEnabled && specialSubs.length > 0 && (
            <div style={{ display:'flex', gap:8 }}>
              <button type="button" onClick={() => { setPayMode('monthly'); setSelectedSpecial(null); }}
                style={{ flex:1, padding:'10px', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer', border:'2px solid',
                  borderColor: payMode==='monthly' ? '#2563eb' : '#e2e8f0',
                  background:  payMode==='monthly' ? '#eff6ff' : '#fff',
                  color:       payMode==='monthly' ? '#1d4ed8' : '#64748b' }}>
                📅 Monthly Installment
              </button>
              <button type="button" onClick={() => { setPayMode('special'); setSelected([]); }}
                style={{ flex:1, padding:'10px', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer', border:'2px solid',
                  borderColor: payMode==='special' ? '#2563eb' : '#e2e8f0',
                  background:  payMode==='special' ? '#eff6ff' : '#fff',
                  color:       payMode==='special' ? '#1d4ed8' : '#64748b' }}>
                🎯 Special Subscription
              </button>
            </div>
          )}

          {/* Monthly months picker */}
          {(payMode === 'monthly' && monthlyEnabled) && (
            <div className="card">
              <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:4 }}>Select Months to Pay</div>
              <p style={{ fontSize:12, color:'#94a3b8', marginBottom:14 }}>Only unpaid months are shown.</p>
              {unpaidMonths.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8' }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>🎉</div>
                  <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:4 }}>All caught up!</div>
                  <div style={{ fontSize:13 }}>No pending months to pay.</div>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
                  {unpaidMonths.map(m => {
                    const sel  = selected.includes(m);
                    const late = isLate(m);
                    return (
                      <button key={m} type="button" onClick={() => toggle(m)}
                        style={{ padding:'10px 12px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', transition:'all 0.15s', textAlign:'left',
                          border:     sel ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          background: sel ? '#eff6ff' : '#fff',
                          color:      sel ? '#1d4ed8' : '#475569' }}>
                        <div style={{ fontWeight:600 }}>{m.replace('-', ' / ')}</div>
                        {late && <div style={{ fontSize:10, color: sel ? '#1d4ed8' : '#f59e0b', marginTop:2 }}>+ ৳{penalty} late fee</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Special subscriptions picker */}
          {(payMode === 'special' || (!monthlyEnabled && specialSubs.length > 0)) && (
            <div className="card">
              <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:4 }}>Special Subscriptions</div>
              <p style={{ fontSize:12, color:'#94a3b8', marginBottom:14 }}>Select one to pay. Already paid subscriptions are hidden.</p>
              {specialSubs.filter(s => !paidSpecial.has(s.id)).length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8' }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
                  <div style={{ fontSize:13 }}>No pending special subscriptions.</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {specialSubs.filter(s => !paidSpecial.has(s.id)).map(s => {
                    const sel      = selectedSpecial?.id === s.id;
                    const deadline = new Date(s.deadline);
                    const daysLeft = Math.ceil((deadline - new Date()) / (1000*60*60*24));
                    return (
                      <button key={s.id} type="button" onClick={() => setSelectedSpecial(sel ? null : s)}
                        style={{ padding:'14px 16px', borderRadius:10, textAlign:'left', cursor:'pointer', transition:'all 0.15s',
                          border:     sel ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          background: sel ? '#eff6ff' : '#fff' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600, fontSize:13, color: sel?'#1d4ed8':'#0f172a' }}>{s.title}</div>
                            {s.description && <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>{s.description}</div>}
                            <div style={{ fontSize:11, color: daysLeft <= 3 ? '#dc2626' : '#f59e0b', marginTop:4, fontWeight:500 }}>
                              Due: {s.deadline} ({daysLeft > 0 ? `${daysLeft} day${daysLeft!==1?'s':''} left` : 'Today!'})
                            </div>
                          </div>
                          <div style={{ fontWeight:700, fontSize:16, color: sel?'#1d4ed8':'#2563eb', flexShrink:0 }}>
                            ৳{s.amount?.toLocaleString()}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Payment method + TxID + summary */}
          {((payMode === 'monthly' && selected.length > 0) || (payMode === 'special' && selectedSpecial) || (!monthlyEnabled && selectedSpecial)) && (
            <div className="card">
              <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:14 }}>Payment Method</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                {enabledMethods.map(m => (
                  <button key={m} type="button" onClick={() => { setMethod(m); setTxId(''); }}
                    style={{ padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
                      border:     method === m ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: method === m ? '#eff6ff' : '#fff',
                      color:      method === m ? '#1d4ed8' : '#475569' }}>
                    {m}
                  </button>
                ))}
              </div>

              {method === 'Cash' && (
                <div className="alert alert-info" style={{ marginBottom:14, fontSize:13 }}>
                  Pay cash directly to your organization admin.
                </div>
              )}

              {method && method !== 'Cash' && (
                <div className="form-group">
                  <label className="form-label">Transaction ID (TxID) *</label>
                  <input value={txId} onChange={e => setTxId(e.target.value)}
                    placeholder={`Paste your ${method} transaction ID`} required />
                </div>
              )}

              {/* Payment summary */}
              <div style={{ background:'#f8fafc', borderRadius:8, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Payment Summary</div>
                {payMode === 'monthly' ? (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                    <span style={{ color:'#64748b' }}>Donation ({selected.length} month{selected.length>1?'s':''} × ৳{baseAmount.toLocaleString()})</span>
                    <span style={{ fontWeight:600 }}>৳{totalBase.toLocaleString()}</span>
                  </div>
                ) : (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                    <span style={{ color:'#64748b' }}>{selectedSpecial?.title}</span>
                    <span style={{ fontWeight:600 }}>৳{totalBase.toLocaleString()}</span>
                  </div>
                )}
                {totalPenalty > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                    <span style={{ color:'#64748b' }}>Late fee (org profit)</span>
                    <span style={{ fontWeight:600, color:'#dc2626' }}>৳{totalPenalty.toLocaleString()}</span>
                  </div>
                )}
                {fee > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                    <span style={{ color:'#64748b' }}>Gateway fee ({(feeRate*100).toFixed(2)}%)</span>
                    <span style={{ fontWeight:600 }}>৳{fee.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:700, borderTop:'1px solid #e2e8f0', paddingTop:10, marginTop:6 }}>
                  <span>Total to send</span>
                  <span style={{ color:'#2563eb' }}>৳{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary" style={{ width:'100%', justifyContent:'center', padding:'13px' }}>
                {loading ? 'Submitting…' : `Submit Payment — ৳${grandTotal.toLocaleString()}`}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
