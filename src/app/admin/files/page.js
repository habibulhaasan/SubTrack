// src/app/admin/files/page.js
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  serverTimestamp, orderBy, query,
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/Modal';

// ─── Constants ────────────────────────────────────────────────────────────
const CATS = ['General','Finance','Legal','Minutes','Announcement','Form','Other'];

// ─── Pure helpers (outside any component) ────────────────────────────────
function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)          return bytes + ' B';
  if (bytes < 1024 * 1024)   return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function fileIcon(mime) {
  if (!mime)                                               return '📄';
  if (mime.startsWith('image/'))                          return '🖼️';
  if (mime.includes('pdf'))                               return '📕';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel'))   return '📊';
  if (mime.includes('zip')  || mime.includes('rar'))      return '🗜️';
  return '📄';
}

async function compressImage(file, maxPx = 1400, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxPx && height <= maxPx) { resolve(file); return; }
      if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
      else                { width  = Math.round(width * maxPx / height); height = maxPx; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function prepareFile(file) {
  if (file.type.startsWith('image/')) return compressImage(file);
  return file;
}

// ─── FileCard — outside AdminFiles so React never remounts ───────────────
function FileCard({ f, onView }) {
  return (
    <div
      onClick={() => onView(f)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.10)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
      style={{ background:'var(--surface,#fff)', border:'1.5px solid var(--border,#e2e8f0)', borderRadius:12, overflow:'hidden', cursor:'pointer', transition:'all 0.15s' }}
    >
      {f.mimeType?.startsWith('image/') && f.thumbUrl ? (
        <div style={{ height:120, overflow:'hidden', background:'var(--surface-2,#f8fafc)' }}>
          <img src={f.thumbUrl} alt={f.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
      ) : (
        <div style={{ height:80, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface-2,#f8fafc)', fontSize:36 }}>
          {fileIcon(f.mimeType)}
        </div>
      )}
      <div style={{ padding:'12px 14px 14px' }}>
        <div style={{ fontWeight:600, fontSize:13, color:'var(--text,#0f172a)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {f.title}
        </div>
        {f.description && (
          <div style={{ fontSize:11, color:'var(--text-muted,#64748b)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {f.description}
          </div>
        )}
        <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'space-between' }}>
          <span className="badge badge-gray" style={{ fontSize:10 }}>{f.category}</span>
          <span style={{ fontSize:10, color:'var(--text-dim,#94a3b8)' }}>{fmtSize(f.size)}</span>
        </div>
        {f.originalSize && f.size < f.originalSize && (
          <div style={{ marginTop:4, fontSize:10, color:'#16a34a', fontWeight:600 }}>
            ↓ Compressed {Math.round((1 - f.size / f.originalSize) * 100)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ─── UploadModal — outside AdminFiles ────────────────────────────────────
function UploadModal({ onClose, orgId, userData }) {
  const [form,       setForm]       = useState({ title:'', description:'', category:'' });
  const [pickedFile, setPickedFile] = useState(null);
  const [progress,   setProgress]   = useState(0);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState('');
  const fileRef = useRef();

  // Stable setters — no inline arrow functions inside JSX
  const setTitle       = useCallback(e => setForm(p => ({ ...p, title:       e.target.value })), []);
  const setDescription = useCallback(e => setForm(p => ({ ...p, description: e.target.value })), []);
  const setCategory    = useCallback(e => setForm(p => ({ ...p, category:    e.target.value })), []);

  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { setError('File too large. Max 50 MB.'); return; }
    setPickedFile(f);
    setForm(p => ({ ...p, title: p.title || f.name.replace(/\.[^.]+$/, '') }));
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!pickedFile)        { setError('Please select a file.');  return; }
    if (!form.title.trim()) { setError('Title is required.');     return; }
    setUploading(true); setProgress(10);
    try {
      const prepared = await prepareFile(pickedFile);
      setProgress(30);
      const fd = new FormData();
      fd.append('file', prepared);
      setProgress(50);
      const res  = await fetch('/api/upload', { method:'POST', body:fd });
      setProgress(80);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await addDoc(collection(db, 'organizations', orgId, 'files'), {
        title:        form.title.trim(),
        description:  form.description.trim(),
        category:     form.category || 'General',
        fileId:       data.fileId,
        fileName:     prepared.name,
        originalName: pickedFile.name,
        mimeType:     data.mimeType || pickedFile.type,
        size:         data.size,
        originalSize: pickedFile.size,
        viewUrl:      data.viewUrl,
        thumbUrl:     data.thumbUrl,
        uploadedBy:   userData?.nameEnglish || 'Admin',
        createdAt:    serverTimestamp(),
      });
      setProgress(100);
      onClose();
    } catch (err) { setError(err.message); }
    setUploading(false);
  };

  return (
    <Modal title="Upload File" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom:14 }}>{error}</div>}

      {/* Drop zone */}
      <div className="form-group">
        <label className="form-label">File *</label>
        <div
          onClick={() => fileRef.current?.click()}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#2563eb'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
          style={{ border:'2px dashed #cbd5e1', borderRadius:10, padding:20, textAlign:'center', cursor:'pointer',
            background: pickedFile ? '#f0fdf4' : 'var(--surface-2,#f8fafc)', transition:'border-color 0.15s' }}
        >
          {pickedFile ? (
            <div>
              <div style={{ fontSize:28, marginBottom:4 }}>{fileIcon(pickedFile.type)}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text,#0f172a)' }}>{pickedFile.name}</div>
              <div style={{ fontSize:11, color:'var(--text-muted,#64748b)', marginTop:2 }}>{fmtSize(pickedFile.size)} · click to change</div>
              {pickedFile.type.startsWith('image/') && (
                <div style={{ fontSize:11, color:'#7c3aed', marginTop:4 }}>✶ Will be compressed before upload</div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-muted,#475569)' }}>Click to browse file</div>
              <div style={{ fontSize:11, color:'var(--text-dim,#94a3b8)', marginTop:2 }}>Max 50 MB · Images auto-compressed · Stored on Google Drive</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" style={{ display:'none' }} onChange={handleFilePick} />
      </div>

      <div className="form-group">
        <label className="form-label">Title *</label>
        <input value={form.title} onChange={setTitle} placeholder="File title" />
      </div>
      <div className="form-group">
        <label className="form-label">Short Description</label>
        <input value={form.description} onChange={setDescription} placeholder="What is this file about?" />
      </div>
      <div className="form-group">
        <label className="form-label">Category</label>
        <select value={form.category} onChange={setCategory}>
          <option value="">Select category…</option>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {uploading && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-muted,#64748b)', marginBottom:4 }}>
            <span>{progress < 50 ? 'Compressing…' : progress < 80 ? 'Uploading to Drive…' : 'Saving…'}</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height:6, background:'var(--border,#e2e8f0)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progress}%`, background:'#2563eb', borderRadius:99, transition:'width 0.3s' }} />
          </div>
        </div>
      )}

      <button onClick={handleSubmit} disabled={uploading} className="btn-primary"
        style={{ width:'100%', justifyContent:'center' }}>
        {uploading ? `${progress < 50 ? 'Compressing' : 'Uploading'} ${progress}%…` : 'Upload to Drive'}
      </button>
    </Modal>
  );
}

// ─── ViewModal — outside AdminFiles ──────────────────────────────────────
function ViewModal({ file, onClose, onDelete }) {
  return (
    <Modal title={file.title} onClose={onClose}>
      {file.mimeType?.startsWith('image/') && file.viewUrl && (
        <div style={{ borderRadius:10, overflow:'hidden', marginBottom:16, background:'var(--surface-2,#f8fafc)', textAlign:'center' }}>
          <img src={file.viewUrl} alt={file.title} style={{ maxWidth:'100%', maxHeight:260, objectFit:'contain' }} />
        </div>
      )}
      <div style={{ textAlign:'center', marginBottom:16 }}>
        {!file.mimeType?.startsWith('image/') && <div style={{ fontSize:48, marginBottom:8 }}>{fileIcon(file.mimeType)}</div>}
        <span className="badge badge-gray">{file.category}</span>
      </div>
      {file.description && (
        <div style={{ background:'var(--surface-2,#f8fafc)', borderRadius:8, padding:'12px 14px', marginBottom:16, fontSize:13, color:'var(--text-muted,#475569)' }}>
          {file.description}
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
        {[
          ['Original name', file.originalName || file.fileName],
          ['File size',     fmtSize(file.size)],
          ['Uploaded by',   file.uploadedBy],
          ['Saved',         file.originalSize && file.size < file.originalSize
            ? `${Math.round((1 - file.size / file.originalSize) * 100)}% smaller` : '—'],
        ].map(([l, v]) => (
          <div key={l} style={{ background:'var(--surface-2,#f8fafc)', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-dim,#94a3b8)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>{l}</div>
            <div style={{ fontSize:12, color:'var(--text,#0f172a)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v || '—'}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={() => onDelete(file)} className="btn-danger" style={{ flexShrink:0 }}>Delete</button>
        <a href={file.viewUrl} target="_blank" rel="noopener noreferrer" className="btn-primary"
          style={{ flex:1, justifyContent:'center', textDecoration:'none' }}>
          ↗ Open / Download
        </a>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function AdminFiles() {
  const { userData, orgData } = useAuth();
  const [files,    setFiles]    = useState([]);
  const [modal,    setModal]    = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const [filter,   setFilter]   = useState('All');
  const [search,   setSearch]   = useState('');
  const orgId = userData?.activeOrgId;

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'organizations', orgId, 'files'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setFiles(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
  }, [orgId]);

  const handleDelete = useCallback(async (file) => {
    if (!confirm(`Delete "${file.title}"?`)) return;
    try {
      if (file.fileId) {
        await fetch('/api/files/delete', {
          method:'DELETE',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ fileId: file.fileId }),
        });
      }
      await deleteDoc(doc(db, 'organizations', orgId, 'files', file.id));
    } catch (err) { alert(err.message); }
    setViewFile(null);
  }, [orgId]);

  const handleSearchChange = useCallback(e => setSearch(e.target.value), []);
  const handleView         = useCallback(f => setViewFile(f), []);
  const openUpload         = useCallback(() => setModal(true), []);
  const closeUpload        = useCallback(() => setModal(false), []);
  const closeView          = useCallback(() => setViewFile(null), []);

  const cats  = ['All', ...CATS];
  const shown = files.filter(f => {
    const matchCat    = filter === 'All' || f.category === filter;
    const matchSearch = !search
      || f.title.toLowerCase().includes(search.toLowerCase())
      || (f.description || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="page-wrap animate-fade">

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {orgData?.logoURL && (
            <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
              <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
            </div>
          )}
          <div>
            <div className="page-title">File Library</div>
            <div className="page-subtitle">
              {files.length} file{files.length !== 1 ? 's' : ''} · Stored on Google Drive
            </div>
          </div>
        </div>
        <button onClick={openUpload} className="btn-primary">+ Upload File</button>
      </div>

      {/* Search + filter */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input
          value={search}
          onChange={handleSearchChange}
          placeholder="Search files…"
          style={{ flex:1, minWidth:160 }}
        />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={filter === c ? 'btn-primary' : 'btn-ghost'}
              style={{ padding:'7px 12px', fontSize:12 }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* File grid */}
      {shown.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'var(--text-dim,#94a3b8)' }}>
          {files.length === 0
            ? 'No files yet. Click "+ Upload File" to add one.'
            : 'No files match your filter.'}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:12 }}>
          {shown.map(f => (
            <FileCard key={f.id} f={f} onView={handleView} />
          ))}
        </div>
      )}

      {modal    && <UploadModal onClose={closeUpload} orgId={orgId} userData={userData} />}
      {viewFile && <ViewModal file={viewFile} onClose={closeView} onDelete={handleDelete} />}
    </div>
  );
}