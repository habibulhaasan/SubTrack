// src/components/Modal.js
'use client';
import { useEffect } from 'react';

/**
 * Universal Modal component.
 * Mobile  → full-width bottom sheet sliding up
 * Desktop → centered dialog in the content area (right of 240px sidebar)
 *
 * Uses the unified .dt-overlay / .dt-sheet classes from globals.css
 * so positioning is controlled in one place.
 *
 * Props:
 *   title    — string shown in header
 *   onClose  — called when backdrop or × is clicked
 *   wide     — optional, makes dialog wider (for forms with side-by-side fields)
 *   children — modal body content
 */
export default function Modal({ title, onClose, wide = false, children }) {
  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop — clicking closes modal */}
      <div className="dt-overlay" onClick={onClose} aria-hidden="true" />

      {/* Dialog — clicks don't bubble to backdrop */}
      <div
        className={`dt-sheet${wide ? ' dt-wide' : ''}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dt-handle" />
        <div className="dt-body">
          <div className="dt-head">
            <h3 className="dt-title">{title}</h3>
            <button className="dt-close" onClick={onClose} aria-label="Close">×</button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}