// src/app/admin/distribution/page.js
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_CATEGORIES = [
  { key: 'profit',      label: 'Profit / Dividend',  color: '#16a34a', icon: '💰' },
  { key: 'investment',  label: 'Re-investment',       color: '#2563eb', icon: '📈' },
  { key: 'charity',     label: 'Charity / Donation',  color: '#dc2626', icon: '❤️' },
  { key: 'reserve',     label: 'Reserve Fund',        color: '#d97706', icon: '🏦' },
  { key: 'operational', label: 'Operational Costs',   color: '#7c3aed', icon: '⚙️' },
];

function PctInput({ value, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <input
        type="number" min="0" max="100" step="0.1"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width:72, textAlign:'right' }}
      />
      <span style={{ fontSize:14, color:'#64748b', fontWeight:600 }}>%</span>
    </div>
  );
}

export default function AdminDistribution() {
  const { userData, orgData, isOrgAdmin, isSuperAdmin, accessMode } = useAuth();
  const orgId = userData?.activeOrgId;

  const [rules, setRules]       = useState({});   // { profit: 30, investment: 40, ... }
  const [totalBalance, setTotalBalance] = useState(0);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [history, setHistory]   = useState([]);
  const [running, setRunning]   = useState(false);
  const [tab, setTab]           = useState('rules'); // 'rules' | 'history'

  // Init rules from org doc
  useEffect(() => {
    if (!orgId) return;
    const unsub = onSnapshot(doc(db, 'organizations', orgId), snap => {
      if (snap.exists()) {
        const saved = snap.data().distributionRules || {};
        const merged = {};
        DEFAULT_CATEGORIES.forEach(c => { merged[c.key] = saved[c.key] ?? 0; });
        setRules(merged);
      }
    });
    return unsub;
  }, [orgId]);

  // Load total balance from verified investments
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [inv, exp] = await Promise.all([
        getDocs(collection(db, 'organizations', orgId, 'investments')),
        getDocs(collection(db, 'organizations', orgId, 'expenses')),
      ]);
      const income   = inv.docs.filter(d => d.data().status === 'verified').reduce((s,d) => s+(d.data().amount||0), 0);
      const outgoing = exp.docs.reduce((s,d) => s+(d.data().amount||0), 0);
      setTotalBalance(income - outgoing);
    })();
  }, [orgId]);

  // Distribution history
  useEffect(() => {
    if (!orgId) return;
    const unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'distributionHistory'),
      snap => setHistory(snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)))
    );
    return unsub;
  }, [orgId]);

  const total = Object.values(rules).reduce((s, v) => s + (Number(v)||0), 0);
  const valid = Math.abs(total - 100) < 0.01;

  const saveRules = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'organizations', orgId), { distributionRules: rules }, { merge: true });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const runDistribution = async () => {
    if (!valid) { alert('Percentages must add up to 100% before distributing.'); return; }
    if (!confirm(`Run distribution on ৳${totalBalance.toLocaleString()} balance?`)) return;
    setRunning(true);
    try {
      const breakdown = {};
      DEFAULT_CATEGORIES.forEach(c => {
        breakdown[c.key] = {
          label:  c.label,
          pct:    rules[c.key] || 0,
          amount: ((rules[c.key] || 0) / 100) * totalBalance,
        };
      });
      await addDoc(collection(db, 'organizations', orgId, 'distributionHistory'), {
        totalBalance,
        rules: { ...rules },
        breakdown,
        createdAt: serverTimestamp(),
        createdBy: userData?.activeOrgId,
      });
      alert('Distribution recorded successfully!');
    } catch (e) { alert(e.message); }
    setRunning(false);
  };

  if (!isOrgAdmin) return (
    <div className="page-wrap"><div style={{ textAlign:'center', padding:80, color:'#94a3b8' }}>Access denied — admins only.</div></div>
  );

  if (!orgData?.features?.profitDistribution) return (
    <div className="page-wrap">
      <div style={{ textAlign:'center', padding:80 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
        <div style={{ fontSize:16, fontWeight:700, color:'#0f172a', marginBottom:8 }}>Feature Not Enabled</div>
        <div style={{ fontSize:13, color:'#64748b' }}>Profit Distribution is not enabled for this organization.<br />Contact your platform superadmin to enable it.</div>
      </div>
    </div>
  );

  return (
    <div className="page-wrap animate-fade">
      <div className="page-header">
        <div className="page-title">Profit Distribution</div>
        <div className="page-subtitle">Set how fund balance is split across categories</div>
      </div>

      {/* Balance summary */}
      <div className="stat-card" style={{ marginBottom:20, background:'linear-gradient(135deg,#1d4ed8,#2563eb)', color:'#fff', borderRadius:14 }}>
        <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', opacity:0.75, marginBottom:6 }}>Available Balance</div>
        <div style={{ fontSize:28, fontWeight:800, letterSpacing:'-0.02em' }}>৳{totalBalance.toLocaleString()}</div>
        <div style={{ fontSize:12, opacity:0.7, marginTop:4 }}>Total verified income minus expenses</div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[['rules','⚙️ Distribution Rules'],['history','📋 History']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={tab===t ? 'btn-primary' : 'btn-ghost'}
            style={{ padding:'9px 18px', fontSize:13 }}>{l}</button>
        ))}
      </div>

      {tab === 'rules' && (
        <>
          {saved && <div className="alert alert-success" style={{ marginBottom:16 }}>Rules saved!</div>}

          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:4 }}>Allocation Rules</div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:16 }}>
              Set the percentage for each category. Total must equal 100%.
            </div>

            {DEFAULT_CATEGORIES.map(cat => {
              const pct    = rules[cat.key] || 0;
              const amount = (pct / 100) * totalBalance;
              return (
                <div key={cat.key} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 0', borderBottom:'1px solid #f1f5f9' }}>
                  <div style={{ width:38, height:38, borderRadius:10, background: cat.color+'15', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:'#0f172a' }}>{cat.label}</div>
                    <div style={{ fontSize:12, color: cat.color, fontWeight:600 }}>
                      ৳{amount.toLocaleString(undefined, { maximumFractionDigits:0 })}
                    </div>
                  </div>
                  <PctInput value={pct} onChange={v => setRules(p => ({ ...p, [cat.key]: v }))} />
                </div>
              );
            })}

            {/* Total row */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0 4px', marginTop:4 }}>
              <span style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>Total</span>
              <span style={{ fontWeight:800, fontSize:16, color: valid ? '#16a34a' : '#dc2626' }}>
                {total.toFixed(1)}%{!valid && ' ⚠️'}
              </span>
            </div>
            {!valid && (
              <div style={{ fontSize:12, color:'#dc2626', marginTop:4 }}>
                Percentages must add up to exactly 100%
              </div>
            )}
          </div>

          {/* Visual bar */}
          <div className="card" style={{ marginBottom:20 }}>
            <div style={{ fontWeight:600, fontSize:13, color:'#64748b', marginBottom:10 }}>Visual Split</div>
            <div style={{ display:'flex', height:20, borderRadius:99, overflow:'hidden', gap:2 }}>
              {DEFAULT_CATEGORIES.filter(c => (rules[c.key]||0) > 0).map(c => (
                <div key={c.key} style={{ flex: rules[c.key]||0, background: c.color, minWidth:2, transition:'flex 0.3s' }} title={`${c.label}: ${rules[c.key]}%`} />
              ))}
              {total < 100 && <div style={{ flex: 100-total, background:'#e2e8f0' }} />}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 16px', marginTop:12 }}>
              {DEFAULT_CATEGORIES.map(c => (
                <div key={c.key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                  <span style={{ width:10, height:10, borderRadius:'50%', background:c.color, display:'inline-block' }} />
                  <span style={{ color:'#475569' }}>{c.label}: <strong>{rules[c.key]||0}%</strong></span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={saveRules} disabled={saving}
              className="btn-primary" style={{ padding:'11px 28px' }}>
              {saving ? 'Saving…' : 'Save Rules'}
            </button>
            <button onClick={runDistribution} disabled={running || !valid || totalBalance <= 0}
              style={{ padding:'11px 28px', borderRadius:8, border:'none', cursor: valid && totalBalance > 0 ? 'pointer' : 'not-allowed', fontWeight:600, fontSize:14, background: valid ? '#dcfce7' : '#f1f5f9', color: valid ? '#15803d' : '#94a3b8' }}>
              {running ? 'Processing…' : '🚀 Run Distribution'}
            </button>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div>
          {history.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>
              No distributions run yet. Set your rules and click "Run Distribution".
            </div>
          ) : history.map(h => (
            <div key={h.id} className="card" style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>Distribution Run</div>
                  <div style={{ fontSize:12, color:'#94a3b8' }}>
                    {h.createdAt?.seconds ? new Date(h.createdAt.seconds * 1000).toLocaleString() : '—'}
                  </div>
                </div>
                <div style={{ fontWeight:800, fontSize:16, color:'#2563eb' }}>৳{(h.totalBalance||0).toLocaleString()}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {Object.values(h.breakdown || {}).map(b => (
                  <div key={b.key} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 10px', background:'#f8fafc', borderRadius:7 }}>
                    <span style={{ color:'#475569' }}>{b.label}</span>
                    <span style={{ fontWeight:600 }}>৳{(b.amount||0).toLocaleString(undefined,{maximumFractionDigits:0})} <span style={{ color:'#94a3b8', fontWeight:400 }}>({b.pct}%)</span></span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}