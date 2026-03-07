// src/app/admin/settings/page.js
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, onSnapshot, updateDoc,
  collection, addDoc, setDoc, getDocs, deleteDoc,
  serverTimestamp, query, where,
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const BASE_METHODS = ['bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Cash'];

function Toggle({ label, sub, value, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #f1f5f9', gap:12 }}>
      <div>
        <div style={{ fontSize:14, color:'#0f172a', fontWeight:500 }}>{label}</div>
        {sub && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{sub}</div>}
      </div>
      <button type="button" onClick={onChange}
        style={{ width:44, height:24, borderRadius:99, border:'none', cursor:'pointer', background: value ? '#2563eb' : '#e2e8f0', position:'relative', flexShrink:0, marginTop:2 }}>
        <span style={{ position:'absolute', top:2, left: value ? 20 : 2, width:20, height:20, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.15)', transition:'left 0.2s' }} />
      </button>
    </div>
  );
}

function genId() { return Math.random().toString(36).slice(2, 9); }

export default function AdminSettings() {
  const { user, userData, orgData } = useAuth();
  const [tab, setTab]         = useState('rules');
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [members,  setMembers]  = useState([]);
  const [invites,  setInvites]  = useState([]);
  const [inviteDays, setInviteDays] = useState(7);

  // ── ALL settings in one unified state ──────────────────────────────────
  // paymentAccounts lives inside settings.paymentAccounts — never separate
  const [settings, setSettings] = useState({});

  // Add-account form (local UI state only — does not touch Firestore until Save)
  const [addingAccount, setAddingAccount] = useState(null);
  const [newAccLabel,   setNewAccLabel]   = useState('');
  const [newAccNumber,  setNewAccNumber]  = useState('');

  // Special subscriptions
  const [specialSubs, setSpecialSubs] = useState([]);
  const [subForm, setSubForm] = useState({ title:'', description:'', amount:'', deadline:'', allowCustomAmount: false });
  const [subSaving, setSubSaving] = useState(false);
  const [subSaved,  setSubSaved]  = useState(false);

  const [logoPreview, setLogoPreview] = useState(null);

  const orgId = userData?.activeOrgId;

  // ── Load org data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;

    const unsub = onSnapshot(doc(db, 'organizations', orgId), snap => {
      if (!snap.exists()) return;
      const d        = snap.data();
      const raw      = d.settings || {};
      const methods  = raw.paymentMethods || BASE_METHODS;

      // Migrate old single-account format (accountDetails) → paymentAccounts array
      const pa = { ...(raw.paymentAccounts || {}) };
      methods.forEach(m => {
        if (!pa[m] && raw.accountDetails?.[m]) {
          pa[m] = [{ id: genId(), label: 'Default', number: raw.accountDetails[m] }];
        }
        if (!pa[m]) pa[m] = [];
      });

      // Store paymentAccounts INSIDE settings state — single source of truth
      setSettings({ ...raw, paymentAccounts: pa });
    });

    // Members (for subscriptions tab)
    getDocs(collection(db, 'organizations', orgId, 'members')).then(async snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const withNames = await Promise.all(docs.map(async m => {
        try {
          const u = await getDoc(doc(db, 'users', m.id));
          return u.exists() ? { ...u.data(), ...m } : m;
        } catch { return m; }
      }));
      setMembers(withNames);
    });

    // Invites
    getDocs(query(collection(db, 'invites'), where('orgId', '==', orgId)))
      .then(snap => setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Special subs
    const unsubSubs = onSnapshot(
      collection(db, 'organizations', orgId, 'specialSubscriptions'),
      snap => setSpecialSubs(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
      )
    );

    return () => { unsub(); unsubSubs(); };
  }, [orgId]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  // Update any top-level settings key
  const set = (k, v) => setSettings(p => ({ ...p, [k]: v }));

  // Get paymentAccounts from unified settings state
  const paymentAccounts = settings.paymentAccounts || {};

  // Update paymentAccounts inside settings (keeps everything in one object)
  const setAccounts = (updater) =>
    setSettings(p => ({
      ...p,
      paymentAccounts: typeof updater === 'function'
        ? updater(p.paymentAccounts || {})
        : updater,
    }));

  const enabledMethods = settings.paymentMethods || BASE_METHODS;

  const toggleMethod = (method) => {
    const current = settings.paymentMethods || BASE_METHODS;
    const updated  = current.includes(method)
      ? current.filter(m => m !== method)
      : [...current, method];
    set('paymentMethods', updated);
    // Ensure paymentAccounts has a slot for this method
    if (!paymentAccounts[method]) {
      setAccounts(prev => ({ ...prev, [method]: [] }));
    }
  };

  // ── Add / remove account (local state only — saved on Save button) ──────
  const addAccount = (method) => {
    if (!newAccNumber.trim()) { alert('Account number is required.'); return; }
    const acc = { id: genId(), label: newAccLabel.trim() || 'Account', number: newAccNumber.trim() };
    setAccounts(prev => ({ ...prev, [method]: [...(prev[method] || []), acc] }));
    setAddingAccount(null);
    setNewAccLabel('');
    setNewAccNumber('');
  };

  const removeAccount = (method, id) => {
    if (!confirm('Remove this account?')) return;
    setAccounts(prev => ({ ...prev, [method]: (prev[method] || []).filter(a => a.id !== id) }));
  };

  // Toggle an account's enabled/disabled state (disabled accounts are hidden from members)
  const toggleAccountEnabled = (method, id) => {
    setAccounts(prev => ({
      ...prev,
      [method]: (prev[method] || []).map(a =>
        a.id === id ? { ...a, enabled: a.enabled === false ? true : false } : a
      ),
    }));
  };

  // ── Single unified save — ALWAYS writes everything together ─────────────
  const saveAll = async () => {
    setSaving(true);
    try {
      // settings already contains paymentAccounts — write the whole thing at once
      await updateDoc(doc(db, 'organizations', orgId), { settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
  };

  // ── Logo ─────────────────────────────────────────────────────────────────
  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const canvas = document.createElement('canvas');
    const img    = new Image();
    const reader = new FileReader();
    reader.onload = ev => {
      img.onload = () => {
        const size = 200;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width-min)/2, (img.height-min)/2, min, min, 0, 0, size, size);
        setLogoPreview(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const saveLogo = async () => {
    if (!logoPreview || !orgId) return;
    try {
      await updateDoc(doc(db, 'organizations', orgId), { logoURL: logoPreview });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert(e.message); }
  };

  // ── Member custom amount ──────────────────────────────────────────────────
  const saveMemberAmount = async (memberId, amount) => {
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'members', memberId), { customAmount: Number(amount) || 0 });
    } catch (e) { console.error(e); }
  };

  // ── Invites ───────────────────────────────────────────────────────────────
  const createInvite = async () => {
    if (!orgId || !orgData) return;
    try {
      const exp = new Date();
      exp.setDate(exp.getDate() + Number(inviteDays));
      const slug     = orgData.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30);
      const inviteId = `${slug}-${Math.random().toString(36).slice(2,7)}`;
      const inviteData = {
        orgId, orgName: orgData.name, orgType: orgData.type,
        orgDescription: orgData.description || '',
        orgSettings: { baseAmount: orgData.settings?.baseAmount, dueDate: orgData.settings?.dueDate },
        expiresAt: { seconds: Math.floor(exp.getTime()/1000) },
        createdAt: serverTimestamp(), createdBy: user.uid, useCount: 0,
      };
      await setDoc(doc(db, 'invites', inviteId), inviteData);
      setInvites(p => [...p, { id: inviteId, ...inviteData }]);
    } catch (e) { alert('Error: ' + e.message); }
  };

  const delInvite = async (id) => {
    try {
      await deleteDoc(doc(db, 'invites', id));
      setInvites(p => p.filter(i => i.id !== id));
    } catch (e) { alert(e.message); }
  };

  // ── Special subscriptions ─────────────────────────────────────────────────
  const createSpecialSub = async (e) => {
    e.preventDefault();
    if (!subForm.title || !subForm.amount || !subForm.deadline) {
      alert('Title, amount, and deadline are required.'); return;
    }
    setSubSaving(true);
    try {
      await addDoc(collection(db, 'organizations', orgId, 'specialSubscriptions'), {
        title: subForm.title, description: subForm.description,
        amount: Number(subForm.amount), deadline: subForm.deadline,
        allowCustomAmount: !!subForm.allowCustomAmount,
        active: true, createdAt: serverTimestamp(), createdBy: user.uid,
      });
      const mSnap   = await getDocs(collection(db, 'organizations', orgId, 'members'));
      const deadline = new Date(subForm.deadline).toLocaleDateString('en-GB');
      const msg     = `📢 Special subscription: "${subForm.title}" — ৳${Number(subForm.amount).toLocaleString()} due by ${deadline}. ${subForm.description||''}`.trim();
      await Promise.all(
        mSnap.docs.filter(d => d.data().approved).map(d =>
          addDoc(collection(db, 'organizations', orgId, 'notifications'), {
            userId: d.id, message: msg, read: false, createdAt: serverTimestamp(),
          })
        )
      );
      setSubForm({ title:'', description:'', amount:'', deadline:'', allowCustomAmount: false });
      setSubSaved(true); setTimeout(() => setSubSaved(false), 3000);
    } catch (e) { alert(e.message); }
    setSubSaving(false);
  };

  const toggleSpecialSub = async (sub) => {
    try { await updateDoc(doc(db, 'organizations', orgId, 'specialSubscriptions', sub.id), { active: !sub.active }); }
    catch (e) { alert(e.message); }
  };

  const deleteSpecialSub = async (id) => {
    if (!confirm('Delete this special subscription?')) return;
    try { await deleteDoc(doc(db, 'organizations', orgId, 'specialSubscriptions', id)); }
    catch (e) { alert(e.message); }
  };

  const TABS = [
    ['rules',         'Rules'],
    ['payments',      'Payment Accounts'],
    ['subscriptions', 'Subscriptions'],
    ['special',       'Special Subs'],
    ['invites',       'Invite Links'],
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-wrap animate-fade">
      <div className="page-header">
        <div className="page-title">Organization Settings</div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, borderBottom:'2px solid #e2e8f0', marginBottom:24, overflowX:'auto' }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding:'10px 18px', background:'none', border:'none', whiteSpace:'nowrap',
              borderBottom: tab===id ? '2px solid #2563eb' : '2px solid transparent',
              fontWeight: tab===id ? 600 : 400, color: tab===id ? '#2563eb' : '#64748b',
              cursor:'pointer', fontSize:14, marginBottom:-2 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Rules tab ────────────────────────────────────────────────────── */}
      {tab === 'rules' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {saved && <div className="alert alert-success">✓ Settings saved successfully.</div>}

          {/* Logo */}
          <div className="card">
            <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:12 }}>Organization Logo</div>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:72, height:72, borderRadius:14, background:'#eff6ff', border:'2px dashed #bfdbfe', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                {(logoPreview || orgData?.logoURL)
                  ? <img src={logoPreview || orgData?.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                  : <span style={{ fontSize:28, color:'#93c5fd' }}>🏢</span>}
              </div>
              <div>
                <label className="btn-ghost" style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', fontSize:13, marginBottom:8 }}>
                  {(logoPreview || orgData?.logoURL) ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" onChange={handleLogo} style={{ display:'none' }} />
                </label>
                {logoPreview && (
                  <button onClick={saveLogo} className="btn-primary" style={{ padding:'8px 16px', fontSize:13, marginLeft:8 }}>Save Logo</button>
                )}
                <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>Square image recommended</p>
              </div>
            </div>
          </div>

          {/* Rules form */}
          <div className="card">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
              {[
                ['baseAmount', 'Monthly Amount',      'number'],
                ['dueDate',    'Due Day (of month)',   'number'],
                ['penalty',    'Late Fee Amount',      'number'],
                ['startDate',  'Start Date',           'date'],
              ].map(([k, l, t]) => (
                <div key={k} className="form-group">
                  <label className="form-label">{l}</label>
                  <input type={t} value={settings[k] || ''}
                    onChange={e => set(k, t === 'number' ? Number(e.target.value) : e.target.value)} />
                </div>
              ))}
            </div>
            <Toggle label="Enable Monthly Installments" value={settings.monthlyEnabled !== false} onChange={() => set('monthlyEnabled', settings.monthlyEnabled === false)} sub="When OFF, members won't see monthly payment options" />
            <Toggle label="Enable Late Fees"            value={!!settings.lateFeeEnabled}         onChange={() => set('lateFeeEnabled', !settings.lateFeeEnabled)}                  sub="Charge penalty for payments after the due date" />
            <Toggle label="Uniform Subscription"       value={!!settings.uniformAmount}           onChange={() => set('uniformAmount', !settings.uniformAmount)}                    sub="All members pay the same base amount" />
            <Toggle label="Show Total Fund to Members"  value={settings.showFund !== false}        onChange={() => set('showFund', settings.showFund === false)}                     sub="Members can see the total collected amount" />
            <Toggle label="Auto-assign Member IDs"      value={!!settings.autoMemberId}            onChange={() => set('autoMemberId', !settings.autoMemberId)}                      sub="Automatically assign sequential IDs when approving members" />
            <Toggle label="Gateway Fees Count as Income" value={!!settings.gatewayFeeInAccounting}  onChange={() => set('gatewayFeeInAccounting', !settings.gatewayFeeInAccounting)}  sub="When ON, gateway fees collected from members are included in total org balance. When OFF, they are excluded." />
            <button onClick={saveAll} disabled={saving} className="btn-primary" style={{ marginTop:20, padding:'10px 28px' }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* ── Payment Accounts tab ─────────────────────────────────────────── */}
      {tab === 'payments' && (
        <div style={{ display:'grid', gap:16 }}>
          {saved && <div className="alert alert-success">✓ Payment accounts saved successfully.</div>}

          <div className="card">
            <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:4 }}>Payment Methods &amp; Accounts</div>
            <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>
              Enable methods and add multiple account numbers per method. Changes are saved when you click <strong>Save</strong> below.
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {BASE_METHODS.map(m => {
                const enabled    = enabledMethods.includes(m);
                const accounts   = paymentAccounts[m] || [];
                const feeEnabled = settings.gatewayFees?.[m]?.enabled ?? false;
                const feeRate    = settings.gatewayFees?.[m]?.rate ?? '';

                const setFee = (field, val) => set('gatewayFees', {
                  ...(settings.gatewayFees || {}),
                  [m]: { ...(settings.gatewayFees?.[m] || {}), [field]: val },
                });

                return (
                  <div key={m} style={{ border:`1.5px solid ${enabled?'#bfdbfe':'#e2e8f0'}`, borderRadius:10, overflow:'hidden', background: enabled?'#f8faff':'#fafafa' }}>

                    {/* Method enable toggle */}
                    <label style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer', borderBottom: enabled ? '1px solid #e2e8f0' : 'none' }}>
                      <input type="checkbox" checked={enabled}
                        onChange={() => toggleMethod(m)}
                        style={{ width:16, height:16, accentColor:'#2563eb', flexShrink:0 }} />
                      <span style={{ fontWeight:600, fontSize:14, color: enabled?'#1d4ed8':'#475569', flex:1 }}>{m}</span>
                      {enabled && m !== 'Cash' && (
                        <span className="badge badge-green" style={{ fontSize:10 }}>
                          {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </label>

                    {enabled && (
                      <div style={{ padding:'14px 16px', display:'grid', gap:12 }}>

                        {/* Accounts list (not for Cash) */}
                        {m !== 'Cash' && (
                          <div>
                            <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                              Accounts
                            </div>

                            {accounts.length === 0 && (
                              <div style={{ fontSize:12, color:'#94a3b8', padding:'8px 0' }}>
                                No accounts added yet. Add one below — members will see these numbers when paying.
                              </div>
                            )}

                            {/* Existing accounts */}
                            {accounts.map(acc => {
                              const isEnabled = acc.enabled !== false;
                              return (
                                <div key={acc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background: isEnabled ? '#fff' : '#f8fafc', border:`1px solid ${isEnabled ? '#e2e8f0' : '#f1f5f9'}`, borderRadius:8, marginBottom:6, opacity: isEnabled ? 1 : 0.7 }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                      <div style={{ fontSize:13, fontWeight:600, color: isEnabled ? '#0f172a' : '#94a3b8', textDecoration: isEnabled ? 'none' : 'line-through' }}>{acc.label}</div>
                                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99, background: isEnabled ? '#dcfce7' : '#f1f5f9', color: isEnabled ? '#15803d' : '#94a3b8' }}>
                                        {isEnabled ? 'Active' : 'Disabled'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize:12, color: isEnabled ? '#475569' : '#94a3b8', fontFamily:'monospace', marginTop:2 }}>{acc.number}</div>
                                  </div>
                                  {/* Enable / disable toggle */}
                                  <button
                                    onClick={() => toggleAccountEnabled(m, acc.id)}
                                    title={isEnabled ? 'Disable this account' : 'Enable this account'}
                                    style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6, border:'none', cursor:'pointer', flexShrink:0,
                                      background: isEnabled ? '#fef3c7' : '#dcfce7',
                                      color:      isEnabled ? '#b45309' : '#15803d' }}>
                                    {isEnabled ? 'Disable' : 'Enable'}
                                  </button>
                                  <button onClick={() => removeAccount(m, acc.id)}
                                    style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:18, padding:'0 4px', lineHeight:1 }}>×</button>
                                </div>
                              );
                            })}

                            {/* Add account inline form */}
                            {addingAccount === m ? (
                              <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'12px', marginTop:4 }}>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                                  <div>
                                    <label className="form-label">Label</label>
                                    <input value={newAccLabel} onChange={e => setNewAccLabel(e.target.value)}
                                      placeholder="e.g. Main Account" />
                                  </div>
                                  <div>
                                    <label className="form-label">Account Number *</label>
                                    <input value={newAccNumber} onChange={e => setNewAccNumber(e.target.value)}
                                      placeholder={m === 'Bank Transfer' ? 'Bank & account number' : `${m} number`}
                                      autoFocus />
                                  </div>
                                </div>
                                <div style={{ display:'flex', gap:8 }}>
                                  <button onClick={() => addAccount(m)} className="btn-primary" style={{ padding:'8px 18px', fontSize:13 }}>
                                    Add
                                  </button>
                                  <button onClick={() => { setAddingAccount(null); setNewAccLabel(''); setNewAccNumber(''); }}
                                    className="btn-ghost" style={{ padding:'8px 14px', fontSize:13 }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setAddingAccount(m); setNewAccLabel(''); setNewAccNumber(''); }}
                                style={{ fontSize:12, color:'#2563eb', background:'none', border:'1px dashed #bfdbfe', borderRadius:7, padding:'7px 16px', cursor:'pointer', marginTop:4, fontWeight:600 }}>
                                + Add Account
                              </button>
                            )}
                          </div>
                        )}

                        {/* Gateway fee (not for Cash) */}
                        {m !== 'Cash' && (
                          <div style={{ background:'#f8fafc', borderRadius:8, padding:'12px 14px', border:'1px solid #e2e8f0' }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: feeEnabled ? 12 : 0 }}>
                              <div>
                                <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>Gateway Fee</div>
                                <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>Automatically add % fee to member payments</div>
                              </div>
                              <button type="button" onClick={() => setFee('enabled', !feeEnabled)}
                                style={{ width:40, height:22, borderRadius:99, border:'none', cursor:'pointer', background: feeEnabled ? '#2563eb' : '#e2e8f0', position:'relative', flexShrink:0 }}>
                                <span style={{ position:'absolute', top:2, left: feeEnabled ? 18 : 2, width:18, height:18, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.15)', transition:'left 0.18s' }} />
                              </button>
                            </div>
                            {feeEnabled && (
                              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                <input type="number" min="0" max="100" step="0.01" value={feeRate}
                                  onChange={e => setFee('rate', e.target.value)} placeholder="e.g. 1.85" style={{ flex:1 }} />
                                <span style={{ fontSize:13, color:'#64748b', whiteSpace:'nowrap' }}>% of total</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Single save button — saves everything together */}
            <button onClick={saveAll} disabled={saving} className="btn-primary"
              style={{ marginTop:20, padding:'11px 32px', fontSize:14 }}>
              {saving ? 'Saving…' : '💾 Save All Payment Settings'}
            </button>
            <p style={{ fontSize:11, color:'#94a3b8', marginTop:8 }}>
              Saves enabled methods, all account numbers, and gateway fees together.
            </p>
          </div>
        </div>
      )}

      {/* ── Subscriptions tab ────────────────────────────────────────────── */}
      {tab === 'subscriptions' && (
        <div className="card">
          <div className="alert alert-info" style={{ fontSize:13, marginBottom:16 }}>
            {settings.uniformAmount
              ? 'Uniform mode is ON — all members use the base amount. Turn it off in Rules to enable custom amounts.'
              : 'Custom amounts per member are active. Edit inline and click away to save.'}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {members.filter(m => m.approved).map(m => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, fontSize:13, color:'#0f172a' }}>{m.nameEnglish || m.id.slice(0,10)}</div>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>{m.idNo || 'No ID'}</div>
                </div>
                <div style={{ fontSize:12, color:'#64748b' }}>Custom amount:</div>
                <input type="number" disabled={!!settings.uniformAmount}
                  defaultValue={m.customAmount ?? settings.baseAmount ?? 0}
                  onBlur={e => !settings.uniformAmount && saveMemberAmount(m.id, e.target.value)}
                  style={{ width:110, textAlign:'right', opacity: settings.uniformAmount ? 0.5 : 1 }} />
              </div>
            ))}
            {members.filter(m => m.approved).length === 0 && (
              <p style={{ color:'#94a3b8', fontSize:13, textAlign:'center', padding:24 }}>No approved members yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Special Subscriptions tab ─────────────────────────────────────── */}
      {tab === 'special' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {subSaved && <div className="alert alert-success">Special subscription created and members notified!</div>}

          <div className="card">
            <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:4 }}>Create Special Subscription</div>
            <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>For one-time fundraising goals with a deadline.</p>
            <form onSubmit={createSpecialSub}>
              <div className="form-group">
                <label className="form-label">Title / Purpose *</label>
                <input value={subForm.title} onChange={e => setSubForm(p=>({...p, title:e.target.value}))} placeholder="e.g. Eid Celebration Fund" required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea rows={2} value={subForm.description} onChange={e => setSubForm(p=>({...p, description:e.target.value}))} placeholder="Explain what this fund is for…" style={{ resize:'vertical' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
                <div className="form-group">
                  <label className="form-label">Amount per Member (৳) *</label>
                  <input type="number" min="1" value={subForm.amount} onChange={e => setSubForm(p=>({...p, amount:e.target.value}))} placeholder="0" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline *</label>
                  <input type="date" value={subForm.deadline} onChange={e => setSubForm(p=>({...p, deadline:e.target.value}))} required />
                </div>
              </div>

              {/* Allow custom amount toggle */}
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'12px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'#f8fafc', marginBottom:16, gap:12 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>Allow Custom Payment Amount</div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                    When ON, members can enter any amount instead of the fixed amount above. The amount above becomes a suggested minimum.
                  </div>
                </div>
                <button type="button" onClick={() => setSubForm(p => ({ ...p, allowCustomAmount: !p.allowCustomAmount }))}
                  style={{ width:44, height:24, borderRadius:99, border:'none', cursor:'pointer', flexShrink:0, marginTop:2,
                    background: subForm.allowCustomAmount ? '#2563eb' : '#e2e8f0', position:'relative' }}>
                  <span style={{ position:'absolute', top:2, left: subForm.allowCustomAmount ? 20 : 2, width:20, height:20, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.15)', transition:'left 0.2s' }} />
                </button>
              </div>
              <button type="submit" disabled={subSaving} className="btn-primary" style={{ padding:'10px 28px' }}>
                {subSaving ? 'Creating…' : 'Create & Notify Members'}
              </button>
            </form>
          </div>

          {specialSubs.length > 0 && (
            <div className="card">
              <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:12 }}>Special Subscriptions</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {specialSubs.map(sub => {
                  const expired = sub.deadline && new Date(sub.deadline) < new Date();
                  return (
                    <div key={sub.id} style={{ padding:'14px 16px', border:`1.5px solid ${sub.active?'#bfdbfe':'#e2e8f0'}`, borderRadius:10, background: sub.active?'#f8faff':'#fafafa' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:14, color:'#0f172a' }}>{sub.title}</div>
                          {sub.description && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{sub.description}</div>}
                          <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                            <span className="badge badge-blue">৳{sub.amount?.toLocaleString()}</span>
                            {sub.allowCustomAmount && <span className="badge badge-green">Custom amount</span>}
                            <span className={`badge ${expired?'badge-red':'badge-yellow'}`}>Due: {sub.deadline}</span>
                            <span className={`badge ${sub.active?'badge-green':'badge-gray'}`}>{sub.active?'Active':'Inactive'}</span>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                          <button onClick={() => toggleSpecialSub(sub)}
                            style={{ padding:'5px 12px', fontSize:12, fontWeight:600, border:'none', borderRadius:6, cursor:'pointer',
                              background: sub.active ? '#fffbeb' : '#dcfce7', color: sub.active ? '#b45309' : '#15803d' }}>
                            {sub.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => deleteSpecialSub(sub.id)}
                            style={{ padding:'5px 10px', fontSize:12, fontWeight:600, border:'none', borderRadius:6, cursor:'pointer', background:'#fee2e2', color:'#b91c1c' }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Invite Links tab ─────────────────────────────────────────────── */}
      {tab === 'invites' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card">
            <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:12 }}>Create Invite Link</div>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <label className="form-label">Expires in</label>
                <select value={inviteDays} onChange={e => setInviteDays(e.target.value)}>
                  {[1,3,7,14,30].map(d => <option key={d} value={d}>{d} day{d>1?'s':''}</option>)}
                </select>
              </div>
              <button onClick={createInvite} className="btn-primary" style={{ padding:'10px 20px', whiteSpace:'nowrap' }}>
                Generate Link
              </button>
            </div>
          </div>

          {invites.length === 0 ? (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:24, fontSize:13 }}>No invite links yet</div>
          ) : invites.map(inv => {
            const url     = `${typeof window !== 'undefined' ? window.location.origin : ''}/join?token=${inv.id}`;
            const exp     = inv.expiresAt?.seconds ? new Date(inv.expiresAt.seconds*1000) : null;
            const expired = exp && exp < new Date();
            return (
              <div key={inv.id} className="card" style={{ padding:'14px 16px' }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}>
                  <input readOnly value={url} onClick={e => e.target.select()}
                    style={{ flex:1, fontSize:12, fontFamily:'monospace', color:'#475569', background:'#f8fafc' }} />
                  <button onClick={() => navigator.clipboard.writeText(url)}
                    className="btn-ghost" style={{ padding:'6px 14px', fontSize:12, whiteSpace:'nowrap' }}>Copy</button>
                  <button onClick={() => delInvite(inv.id)}
                    style={{ padding:'6px 12px', fontSize:12, border:'none', background:'#fee2e2', color:'#b91c1c', borderRadius:6, cursor:'pointer' }}>Delete</button>
                </div>
                <div style={{ fontSize:11, color: expired ? '#dc2626' : '#94a3b8' }}>
                  {exp ? (expired ? '✕ Expired: ' : '✓ Expires: ') + exp.toLocaleDateString('en-GB') : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
