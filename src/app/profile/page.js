// src/app/profile/page.js
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

// ─── Sub-components defined OUTSIDE Profile so React never remounts inputs ───

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
      <div style={{ width: 160, fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: value ? '#0f172a' : '#94a3b8' }}>{value || '—'}</div>
    </div>
  );
}

// Field receives value + onChange as props — no internal state, no remounting
function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
      />
    </div>
  );
}

function BloodGroupSelect({ value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">Blood Group</label>
      <select value={value || ''} onChange={onChange}>
        <option value="">Select…</option>
        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Page component ────────────────────────────────────────────────────────

export default function Profile() {
  const { user, userData, membership } = useAuth();
  const [editing, setEditing]           = useState(false);
  const [form, setForm]                 = useState({});
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Sync form with latest userData (only when not editing to avoid clobbering)
  useEffect(() => {
    if (userData && !editing) setForm(userData);
  }, [userData, editing]);

  if (!userData) return <div style={{ padding: 40, color: '#94a3b8' }}>Loading…</div>;

  // Single setter — stable reference, no new function created per field
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const canvas = document.createElement('canvas');
    const img    = new Image();
    const reader = new FileReader();
    reader.onload = ev => {
      img.onload = () => {
        const size = 300;
        canvas.width  = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
        setPhotoPreview(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const upd = { ...form };
      if (photoPreview) upd.photoURL = photoPreview;
      Object.keys(upd).forEach(k => upd[k] === undefined && delete upd[k]);
      await updateDoc(doc(db, 'users', user.uid), upd);
      setEditing(false);
      setPhotoPreview(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { alert('Save failed: ' + e.message); }
    setSaving(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm(userData);
    setPhotoPreview(null);
  };

  const photo    = photoPreview || userData.photoURL;
  const initials = (userData.nameEnglish || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="page-wrap animate-fade">
      <div className="page-header">
        <div className="page-title">My Profile</div>
        <div className="page-subtitle">Your personal information</div>
      </div>

      {saved && <div className="alert alert-success">Profile updated successfully.</div>}

      {/* Header card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {photo
              ? <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <span style={{ fontSize: 22, fontWeight: 700, color: '#1d4ed8' }}>{initials}</span>}
          </div>
          {editing && (
            <label style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{userData.nameEnglish}</div>
          {userData.nameBengali && <div style={{ fontSize: 14, color: '#64748b' }}>{userData.nameBengali}</div>}
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
            {membership?.idNo || 'No ID'} · <span style={{ textTransform: 'capitalize' }}>{membership?.role || 'member'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {editing ? (
            <>
              <button onClick={cancelEdit} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button onClick={() => { setForm(userData); setEditing(true); }} className="btn-primary">
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing ? (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Field label="Full Name (English)" value={form.nameEnglish} onChange={set('nameEnglish')} placeholder="John Doe" />
            <Field label="Full Name (Bengali)"  value={form.nameBengali} onChange={set('nameBengali')} placeholder="জন ডো" />
            <Field label="Father's Name"        value={form.fatherName}  onChange={set('fatherName')}  placeholder="Father's name" />
            <Field label="Mother's Name"        value={form.motherName}  onChange={set('motherName')}  placeholder="Mother's name" />
            <Field label="Date of Birth"        value={form.dob}         onChange={set('dob')}         type="date" />
            <BloodGroupSelect value={form.bloodGroup} onChange={set('bloodGroup')} />
            <Field label="Occupation" value={form.occupation} onChange={set('occupation')} placeholder="e.g. Teacher" />
            <Field label="NID Number" value={form.nid}        onChange={set('nid')}        placeholder="NID" />
            <Field label="Phone"      value={form.phone}      onChange={set('phone')}      type="tel" placeholder="+8801XXXXXXXXX" />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              rows={2}
              value={form.address || ''}
              onChange={set('address')}
              placeholder="Full address"
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
      ) : (
        <div className="card">
          <Row label="Email"         value={userData.email} />
          <Row label="Phone"         value={userData.phone} />
          <Row label="Date of Birth" value={userData.dob} />
          <Row label="Blood Group"   value={userData.bloodGroup} />
          <Row label="Father"        value={userData.fatherName} />
          <Row label="Mother"        value={userData.motherName} />
          <Row label="NID"           value={userData.nid} />
          <Row label="Occupation"    value={userData.occupation} />
          <Row label="Address"       value={userData.address} />
        </div>
      )}
    </div>
  );
}