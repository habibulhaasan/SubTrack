// src/app/files/page.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const CATS = ['All','General','Finance','Legal','Minutes','Announcement','Form','Other'];

// ─── Helpers outside component ────────────────────────────────────────────
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

// ─── FileCard outside component ───────────────────────────────────────────
function FileCard({ f, isSelected, onToggle }) {
  return (
    <div
      onClick={() => onToggle(f)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.10)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
      style={{
        background:'var(--surface,#fff)',
        border:`1.5px solid ${isSelected ? '#2563eb' : 'var(--border,#e2e8f0)'}`,
        borderRadius:12, overflow:'hidden', cursor:'pointer', transition:'all 0.15s',
      }}
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
          <div style={{ fontSize:11, color:'var(--text-muted,#64748b)', marginBottom:6, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
            {f.description}
          </div>
        )}
        <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'space-between' }}>
          <span className="badge badge-gray" style={{ fontSize:10 }}>{f.category}</span>
          {f.size && <span style={{ fontSize:10, color:'var(--text-dim,#94a3b8)' }}>{fmtSize(f.size)}</span>}
        </div>

        {/* Expand on select */}
        {isSelected && (
          <div
            style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--border,#e2e8f0)' }}
            onClick={e => e.stopPropagation()}
          >
            {f.mimeType?.startsWith('image/') && f.viewUrl && (
              <div style={{ borderRadius:8, overflow:'hidden', marginBottom:8, background:'var(--surface-2,#f8fafc)', textAlign:'center' }}>
                <img src={f.viewUrl} alt={f.title} style={{ maxWidth:'100%', maxHeight:200, objectFit:'contain' }} />
              </div>
            )}
            <a href={f.viewUrl} target="_blank" rel="noopener noreferrer"
              className="btn-primary"
              style={{ display:'flex', justifyContent:'center', textDecoration:'none', fontSize:13 }}>
              ↗ Open / Download
            </a>
            {f.uploadedBy && (
              <div style={{ marginTop:6, fontSize:10, color:'var(--text-dim,#94a3b8)', textAlign:'center' }}>
                Uploaded by {f.uploadedBy}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function MemberFiles() {
  const { userData, orgData } = useAuth();
  const [files,    setFiles]    = useState([]);
  const [filter,   setFilter]   = useState('All');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const orgId = userData?.activeOrgId;

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'organizations', orgId, 'files'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setFiles(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
  }, [orgId]);

  const handleToggle      = useCallback(f => setSelected(s => s?.id === f.id ? null : f), []);
  const handleSearchChange = useCallback(e => setSearch(e.target.value), []);

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
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        {orgData?.logoURL && (
          <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
            <img src={orgData.logoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
          </div>
        )}
        <div>
          <div className="page-title">File Library</div>
          <div className="page-subtitle">{files.length} file{files.length !== 1 ? 's' : ''} available</div>
        </div>
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
          {CATS.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={filter === c ? 'btn-primary' : 'btn-ghost'}
              style={{ padding:'7px 12px', fontSize:12, whiteSpace:'nowrap' }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* File grid */}
      {shown.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'var(--text-dim,#94a3b8)' }}>
          {files.length === 0 ? 'No files available yet.' : 'No files match your search.'}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:12 }}>
          {shown.map(f => (
            <FileCard
              key={f.id}
              f={f}
              isSelected={selected?.id === f.id}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}