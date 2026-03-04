// src/app/superadmin/features/page.js
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const FEATURES = [
  {
    key: 'profitDistribution',
    label: 'Profit Distribution',
    description: 'Allows admin to split fund balance into categories (profit, investment, charity, reserve, etc.) with % rules.',
    icon: '📊', color: '#16a34a', bg: '#dcfce7',
  },
  {
    key: 'advancedReports',
    label: 'Advanced Reports',
    description: 'Export detailed financial reports with charts and member-wise breakdown.',
    icon: '📈', color: '#2563eb', bg: '#dbeafe',
  },
  {
    key: 'charityTracking',
    label: 'Charity Tracking',
    description: 'Track donations sent to charity/external causes with receipts.',
    icon: '❤️', color: '#dc2626', bg: '#fee2e2',
  },
  {
    key: 'investmentPortfolio',
    label: 'Investment Portfolio',
    description: 'Full investment tracking with ROI calculations and maturity alerts.',
    icon: '💹', color: '#d97706', bg: '#fef3c7',
  },
  {
    key: 'fileLibrary',
    label: 'File Library',
    description: 'Upload and share documents, images, and files with members. Supports categories and descriptions.',
    icon: '📁', color: '#7c3aed', bg: '#ede9fe',
  },
];

function Toggle({ enabled, onChange, saving }) {
  return (
    <button type="button" onClick={onChange} disabled={saving}
      style={{ width:44, height:24, borderRadius:99, border:'none', cursor: saving ? 'wait' : 'pointer', background: enabled ? '#2563eb' : '#e2e8f0', position:'relative', flexShrink:0, opacity: saving ? 0.6 : 1, transition:'background 0.2s' }}>
      <span style={{ position:'absolute', top:2, left: enabled ? 20 : 2, width:20, height:20, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.15)', transition:'left 0.2s' }} />
    </button>
  );
}

export default function SuperAdminFeatures() {
  const { isSuperAdmin } = useAuth();
  const [orgs, setOrgs]     = useState([]);
  const [selOrg, setSelOrg] = useState(null);
  const [saving, setSaving] = useState('');
  const [toast, setToast]   = useState('');

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsub = onSnapshot(collection(db, 'organizations'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name||'').localeCompare(b.name||''));
      setOrgs(list);
      setSelOrg(prev => prev ? (list.find(o => o.id === prev.id) || null) : null);
    });
    return unsub;
  }, [isSuperAdmin]);

  const toggleFeature = async (featureKey) => {
    if (!selOrg) return;
    const current = selOrg.features?.[featureKey] || false;
    setSaving(featureKey);
    try {
      await updateDoc(doc(db, 'organizations', selOrg.id), {
        [`features.${featureKey}`]: !current,
      });
      setToast(`${!current ? 'Enabled' : 'Disabled'} successfully!`);
      setTimeout(() => setToast(''), 2500);
    } catch (e) {
      setToast('Error: ' + e.message);
      setTimeout(() => setToast(''), 4000);
    }
    setSaving('');
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="page-wrap animate-fade">
      <div className="page-header">
        <div style={{ fontSize:11, fontWeight:600, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Super Admin</div>
        <div className="page-title">Org Features</div>
        <div className="page-subtitle">Enable or disable special features for each organization</div>
      </div>

      {toast && (
        <div style={{ padding:'10px 16px', borderRadius:8, background: toast.startsWith('Error') ? '#fee2e2' : '#dcfce7', color: toast.startsWith('Error') ? '#b91c1c' : '#15803d', fontSize:13, fontWeight:600, marginBottom:16 }}>
          {toast}
        </div>
      )}

      {/* Org picker */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:10 }}>Select Organization</div>
        {orgs.length === 0
          ? <p style={{ fontSize:13, color:'#94a3b8' }}>No organizations yet.</p>
          : <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {orgs.map(o => (
                <button key={o.id} onClick={() => setSelOrg(o)}
                  style={{ padding:'8px 14px', borderRadius:8, fontSize:13, fontWeight: selOrg?.id===o.id ? 600 : 400, cursor:'pointer',
                    border:     selOrg?.id===o.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: selOrg?.id===o.id ? '#eff6ff' : '#fff',
                    color:      selOrg?.id===o.id ? '#1d4ed8' : '#475569' }}>
                  {o.name}
                  <span style={{ marginLeft:5, fontSize:10, opacity:0.6, textTransform:'capitalize' }}>({o.status||'active'})</span>
                </button>
              ))}
            </div>
        }
      </div>

      {selOrg ? (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            {selOrg.logoURL && (
              <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
                <img src={selOrg.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
              </div>
            )}
            <div>
              <div style={{ fontWeight:700, fontSize:16, color:'#0f172a' }}>{selOrg.name}</div>
              <div style={{ fontSize:12, color:'#64748b' }}>{selOrg.type} · {selOrg.status||'active'}</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
            {FEATURES.map(f => {
              const enabled = selOrg.features?.[f.key] || false;
              return (
                <div key={f.key} className="card" style={{ border:`1.5px solid ${enabled ? f.color + '33' : '#e2e8f0'}`, transition:'border 0.2s' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                    <div style={{ display:'flex', gap:12, flex:1 }}>
                      <div style={{ width:42, height:42, borderRadius:10, background:f.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                        {f.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:4 }}>{f.label}</div>
                        <div style={{ fontSize:12, color:'#64748b', lineHeight:1.5 }}>{f.description}</div>
                      </div>
                    </div>
                    <Toggle enabled={enabled} onChange={() => toggleFeature(f.key)} saving={saving === f.key} />
                  </div>
                  <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background: enabled ? f.color : '#cbd5e1', display:'inline-block' }} />
                    <span style={{ fontSize:11, fontWeight:600, color: enabled ? f.color : '#94a3b8' }}>
                      {enabled ? 'Enabled for this org' : 'Not enabled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ textAlign:'center', color:'#94a3b8', padding:'60px 20px', fontSize:14 }}>
          ↑ Select an organization to manage its features
        </div>
      )}
    </div>
  );
}
