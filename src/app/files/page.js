// src/app/files/page.js
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const CATS = ['All','General','Finance','Legal','Minutes','Announcement','Form','Other'];

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function fileIcon(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/'))                           return '🖼️';
  if (mime.includes('pdf'))                                return '📕';
  if (mime.includes('word') || mime.includes('document'))  return '📝';
  if (mime.includes('sheet') || mime.includes('excel'))    return '📊';
  if (mime.includes('zip')  || mime.includes('rar'))       return '🗜️';
  return '📄';
}

export default function MemberFiles() {
  const { userData, orgData } = useAuth();
  const [files,    setFiles]  = useState([]);
  const [filter,   setFilter] = useState('All');
  const [search,   setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const orgId = userData?.activeOrgId;

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'organizations', orgId, 'files'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, snap => setFiles(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
  }, [orgId]);

  const shown = files.filter(f => {
    const matchCat    = filter === 'All' || f.category === filter;
    const matchSearch = !search || f.title.toLowerCase().includes(search.toLowerCase())
                        || (f.description||'').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="page-wrap animate-fade">

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        {orgData?.logoURL && (
          <div style={{ width:40,height:40,borderRadius:10,overflow:'hidden',flexShrink:0 }}>
            <img src={orgData.logoURL} style={{ width:'100%',height:'100%',objectFit:'cover' }} alt="" />
          </div>
        )}
        <div>
          <div className="page-title">File Library</div>
          <div className="page-subtitle">{files.length} file{files.length!==1?'s':''} available</div>
        </div>
      </div>

      {/* Search + filter bar */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search files…"
          style={{ flex:1, minWidth:160, padding:'9px 14px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:13, outline:'none' }}
        />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              style={{ padding:'7px 12px', borderRadius:8, fontSize:12, fontWeight: filter===c?700:400, border: filter===c?'2px solid #2563eb':'1px solid #e2e8f0', background: filter===c?'#eff6ff':'#fff', color: filter===c?'#1d4ed8':'#475569', cursor:'pointer', whiteSpace:'nowrap' }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* File grid */}
      {shown.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}>
          {files.length === 0 ? 'No files available yet.' : 'No files match your search.'}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:12 }}>
          {shown.map(f => (
            <div key={f.id}
              style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px', cursor:'pointer', transition:'box-shadow 0.15s' }}
              onClick={() => setSelected(selected?.id === f.id ? null : f)}
              onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
            >
              <div style={{ fontSize:32, marginBottom:10 }}>{fileIcon(f.mimeType)}</div>
              <div style={{ fontWeight:600, fontSize:14, color:'#0f172a', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {f.title}
              </div>
              {f.description && (
                <div style={{ fontSize:12, color:'#64748b', marginBottom:8, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                  {f.description}
                </div>
              )}
              <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'space-between', marginTop:'auto' }}>
                <span className="badge badge-gray" style={{ fontSize:10 }}>{f.category}</span>
                {f.size && <span style={{ fontSize:11, color:'#94a3b8' }}>{fmtSize(f.size)}</span>}
              </div>

              {/* Inline expand on click */}
              {selected?.id === f.id && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #e2e8f0' }} onClick={e => e.stopPropagation()}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ display:'flex', justifyContent:'center', width:'100%', textDecoration:'none', fontSize:13 }}
                  >
                    ↗ Open / Download
                  </a>
                  {f.uploadedBy && (
                    <div style={{ marginTop:8, fontSize:11, color:'#94a3b8', textAlign:'center' }}>
                      Uploaded by {f.uploadedBy}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
