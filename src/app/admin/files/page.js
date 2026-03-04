// src/app/admin/files/page.js
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  serverTimestamp, orderBy, query
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const CATS = ['General','Finance','Legal','Minutes','Announcement','Form','Other'];

const MODAL_CSS = `
  .fl-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;}
  .fl-dialog{
    position:fixed;bottom:0;left:0;right:0;
    max-height:92vh;background:#fff;
    border-radius:20px 20px 0 0;
    overflow-y:auto;z-index:9001;
    animation:flUp .25s cubic-bezier(.32,1,.32,1) both;
  }
  @keyframes flUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
  .fl-pill{width:40px;height:4px;background:#e2e8f0;border-radius:99px;margin:12px auto 4px;}
  .fl-body{padding:16px 20px 48px;}
  .fl-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
  @media(min-width:769px){
    .fl-dialog{
      top:50%;left:calc(50% + 120px);right:auto;bottom:auto;
      width:520px;max-width:calc(100vw - 280px);
      max-height:88vh;border-radius:16px;
      box-shadow:0 20px 60px rgba(0,0,0,.2);
      transform:translate(-50%,-50%);
      animation:flPop .18s ease both;
    }
    @keyframes flPop{
      from{opacity:0;transform:translate(-50%,-48%) scale(.96)}
      to{opacity:1;transform:translate(-50%,-50%) scale(1)}
    }
    .fl-pill{display:none;}
    .fl-body{padding:28px 32px 36px;}
  }
`;

/* ── compress images before upload ── */
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

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function fileIcon(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/'))                          return '🖼️';
  if (mime.includes('pdf'))                               return '📕';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel'))   return '📊';
  if (mime.includes('zip')  || mime.includes('rar'))      return '🗜️';
  return '📄';
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <>
      <style>{MODAL_CSS}</style>
      <div className="fl-backdrop" onClick={onClose} />
      <div className="fl-dialog">
        <div className="fl-pill" />
        <div className="fl-body">
          <div className="fl-head">
            <h3 style={{ fontSize:16, fontWeight:700, color:'#0f172a', margin:0 }}>{title}</h3>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:28, lineHeight:1, padding:0 }}>\xd7</button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

export default function AdminFiles() {
  const { userData, orgData } = useAuth();
  const [files,      setFiles]      = useState([]);
  const [modal,      setModal]      = useState(false);
  const [viewFile,   setViewFile]   = useState(null);
  const [form,       setForm]       = useState({ title:'', description:'', category:'' });
  const [pickedFile, setPickedFile] = useState(null);
  const [progress,   setProgress]   = useState(0);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState('');
  const [filter,     setFilter]     = useState('All');
  const [search,     setSearch]     = useState('');
  const fileRef = useRef();
  const orgId   = userData?.activeOrgId;
  const set     = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'organizations', orgId, 'files'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setFiles(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
  }, [orgId]);

  const openUpload  = () => { setForm({ title:'', description:'', category:'' }); setPickedFile(null); setError(''); setProgress(0); setModal(true); };
  const closeModal  = useCallback(() => { setModal(false); setViewFile(null); }, []);

  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { setError('File too large. Max 50 MB.'); return; }
    setPickedFile(f);
    if (!form.title) set('title', f.name.replace(/\.[^.]+$/, ''));
    setError('');
  };

  const handleUpload = async (e) => {
    e.preventDefault(); setError('');
    if (!pickedFile)        { setError('Please select a file.'); return; }
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setUploading(true); setProgress(10);

    try {
      // Compress if image
      const prepared = await prepareFile(pickedFile);
      setProgress(30);

      // Upload via API route → Google Drive
      const fd = new FormData();
      fd.append('file', prepared);

      setProgress(50);
      const res  = await fetch('/api/upload', { method:'POST', body: fd });
      setProgress(80);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed');

      // Save metadata to Firestore
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
      setModal(false);
    } catch (err) { setError(err.message); }
    setUploading(false);
  };

  const handleDelete = async (file) => {
    if (!confirm(`Delete "${file.title}"?`)) return;
    try {
      // Delete from Google Drive
      if (file.fileId) {
        await fetch('/api/files/delete', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ fileId: file.fileId }),
        });
      }
      // Delete Firestore metadata
      await deleteDoc(doc(db, 'organizations', orgId, 'files', file.id));
    } catch (err) { alert(err.message); }
    setViewFile(null);
  };

  const cats  = ['All', ...CATS];
  const shown = files.filter(f => {
    const matchCat    = filter === 'All' || f.category === filter;
    const matchSearch = !search || f.title.toLowerCase().includes(search.toLowerCase()) || (f.description||'').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="page-wrap animate-fade">

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {orgData?.logoURL && <div style={{ width:40,height:40,borderRadius:10,overflow:'hidden',flexShrink:0 }}><img src={orgData.logoURL} style={{ width:'100%',height:'100%',objectFit:'cover' }} alt="" /></div>}
          <div>
            <div className="page-title">File Library</div>
            <div className="page-subtitle">{files.length} file{files.length!==1?'s':''} · Stored on Google Drive</div>
          </div>
        </div>
        <button onClick={openUpload} className="btn-primary">+ Upload File</button>
      </div>

      {/* Search + filter */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files\u2026"
          style={{ flex:1, minWidth:160, padding:'9px 14px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:13 }} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              style={{ padding:'7px 12px', borderRadius:8, fontSize:12, fontWeight:filter===c?700:400,
                border:filter===c?'2px solid #2563eb':'1px solid #e2e8f0',
                background:filter===c?'#eff6ff':'#fff', color:filter===c?'#1d4ed8':'#475569', cursor:'pointer' }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* File grid */}
      {shown.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}>
          {files.length === 0 ? 'No files yet. Click \u201c+ Upload File\u201d to add one.' : 'No files match your filter.'}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:12 }}>
          {shown.map(f => (
            <div key={f.id}
              style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', cursor:'pointer', transition:'box-shadow 0.15s' }}
              onClick={() => setViewFile(f)}
              onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
            >
              {/* Thumbnail for images, icon for docs */}
              {f.mimeType?.startsWith('image/') && f.thumbUrl ? (
                <div style={{ height:120, overflow:'hidden', background:'#f8fafc' }}>
                  <img src={f.thumbUrl} alt={f.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
              ) : (
                <div style={{ height:80, display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc', fontSize:36 }}>
                  {fileIcon(f.mimeType)}
                </div>
              )}
              <div style={{ padding:'12px 14px 14px' }}>
                <div style={{ fontWeight:600, fontSize:13, color:'#0f172a', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.title}</div>
                {f.description && <div style={{ fontSize:11, color:'#64748b', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.description}</div>}
                <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'space-between' }}>
                  <span className="badge badge-gray" style={{ fontSize:10 }}>{f.category}</span>
                  <span style={{ fontSize:10, color:'#94a3b8' }}>{fmtSize(f.size)}</span>
                </div>
                {f.originalSize && f.size < f.originalSize && (
                  <div style={{ marginTop:4, fontSize:10, color:'#16a34a', fontWeight:600 }}>
                    \u2193 Compressed {Math.round((1-f.size/f.originalSize)*100)}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {modal && (
        <Modal title="Upload File" onClose={closeModal}>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleUpload}>
            <div className="form-group">
              <label className="form-label">File *</label>
              <div onClick={() => fileRef.current?.click()}
                style={{ border:'2px dashed #cbd5e1', borderRadius:10, padding:'20px', textAlign:'center', cursor:'pointer', background:pickedFile?'#f0fdf4':'#f8fafc' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='#2563eb'}
                onMouseLeave={e => e.currentTarget.style.borderColor='#cbd5e1'}
              >
                {pickedFile ? (
                  <div>
                    <div style={{ fontSize:28, marginBottom:4 }}>{fileIcon(pickedFile.type)}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{pickedFile.name}</div>
                    <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{fmtSize(pickedFile.size)} \xb7 click to change</div>
                    {pickedFile.type.startsWith('image/') && <div style={{ fontSize:11, color:'#7c3aed', marginTop:4 }}>\u2736 Will be compressed before upload</div>}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#475569' }}>Click to browse file</div>
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Max 50 MB \xb7 Images auto-compressed \xb7 Stored on Google Drive</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" style={{ display:'none' }} onChange={handleFilePick} />
            </div>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="File title" required />
            </div>
            <div className="form-group">
              <label className="form-label">Short Description</label>
              <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="What is this file about?" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select category\u2026</option>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {uploading && (
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#64748b', marginBottom:4 }}>
                  <span>{progress < 50 ? 'Compressing\u2026' : progress < 80 ? 'Uploading to Drive\u2026' : 'Saving\u2026'}</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ height:6, background:'#e2e8f0', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${progress}%`, background:'#2563eb', borderRadius:99, transition:'width 0.3s' }} />
                </div>
              </div>
            )}
            <button type="submit" disabled={uploading} className="btn-primary" style={{ width:'100%', justifyContent:'center' }}>
              {uploading ? `${progress < 50 ? 'Compressing' : 'Uploading'} ${progress}%\u2026` : 'Upload to Drive'}
            </button>
          </form>
        </Modal>
      )}

      {/* View / Delete Modal */}
      {viewFile && (
        <Modal title={viewFile.title} onClose={closeModal}>
          {viewFile.mimeType?.startsWith('image/') && viewFile.viewUrl && (
            <div style={{ borderRadius:10, overflow:'hidden', marginBottom:16, background:'#f8fafc', textAlign:'center' }}>
              <img src={viewFile.viewUrl} alt={viewFile.title} style={{ maxWidth:'100%', maxHeight:260, objectFit:'contain' }} />
            </div>
          )}
          <div style={{ textAlign:'center', marginBottom:16 }}>
            {!viewFile.mimeType?.startsWith('image/') && <div style={{ fontSize:48, marginBottom:8 }}>{fileIcon(viewFile.mimeType)}</div>}
            <span className="badge badge-gray">{viewFile.category}</span>
          </div>
          {viewFile.description && (
            <div style={{ background:'#f8fafc', borderRadius:8, padding:'12px 14px', marginBottom:16, fontSize:13, color:'#475569' }}>
              {viewFile.description}
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
            {[
              ['Original name', viewFile.originalName],
              ['File size',     fmtSize(viewFile.size)],
              ['Uploaded by',   viewFile.uploadedBy],
              ['Saved',         viewFile.originalSize && viewFile.size < viewFile.originalSize ? `${Math.round((1-viewFile.size/viewFile.originalSize)*100)}% smaller` : '\u2014'],
            ].map(([l, v]) => (
              <div key={l} style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:12, color:'#0f172a', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v||'\u2014'}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => handleDelete(viewFile)} className="btn-danger" style={{ flexShrink:0 }}>Delete</button>
            <a href={viewFile.viewUrl} target="_blank" rel="noopener noreferrer" className="btn-primary"
              style={{ flex:1, justifyContent:'center', textDecoration:'none' }}>
              \u2197 Open / Download
            </a>
          </div>
        </Modal>
      )}

    </div>
  );
}