// src/components/Modal.js
'use client';
import { useEffect } from 'react';

/**
 * Universal Modal component.
 * Mobile  → full-width bottom sheet sliding up
 * Desktop → centered dialog offset for 240px sidebar
 *
 * Usage:
 *   <Modal title="Add Expense" onClose={() => setModal(null)} wide={false}>
 *     ...children...
 *   </Modal>
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

  return (
    <>
      <style>{`
        /* ── Backdrop ──────────────────────────────── */
        .dt-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.52);
          z-index: 9000;
        }

        /* ── Dialog — mobile bottom sheet ─────────── */
        .dt-modal-dialog {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 92vh;
          background: #fff;
          border-radius: 20px 20px 0 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          z-index: 9001;
          animation: dtSlideUp .26s cubic-bezier(.32, 1, .32, 1) both;
        }
        @keyframes dtSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

        .dt-modal-handle {
          width: 40px; height: 4px;
          background: #cbd5e1; border-radius: 99px;
          margin: 12px auto 0;
        }
        .dt-modal-body { padding: 12px 20px 48px; }
        .dt-modal-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .dt-modal-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        .dt-modal-close {
          background: none; border: none;
          cursor: pointer; color: #94a3b8;
          font-size: 28px; line-height: 1;
          padding: 0 0 0 12px; flex-shrink: 0;
        }

        /* ── Dialog — desktop centered ─────────────
           left: calc(50% + 120px) centres the dialog
           in the content area (viewport minus 240px sidebar).
           120px = half the sidebar width.
        ──────────────────────────────────────────── */
        @media (min-width: 769px) {
          .dt-modal-dialog {
            top: 50%;
            bottom: auto;
            left: calc(50% + 120px);
            right: auto;
            width: 520px;
            max-width: calc(100vw - 280px);
            max-height: 88vh;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
            transform: translate(-50%, -50%);
            animation: dtPop .18s ease both;
          }
          .dt-modal-dialog.dt-modal-wide {
            width: 620px;
          }
          @keyframes dtPop {
            from { opacity: 0; transform: translate(-50%, -48%) scale(.96); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
          .dt-modal-handle { display: none; }
          .dt-modal-body   { padding: 24px 32px 36px; }
        }
      `}</style>

      {/* Backdrop — clicking closes modal */}
      <div className="dt-modal-backdrop" onClick={onClose} />

      {/* Dialog — clicks don't bubble to backdrop */}
      <div className={`dt-modal-dialog${wide ? ' dt-modal-wide' : ''}`}
           onClick={e => e.stopPropagation()}>
        <div className="dt-modal-handle" />
        <div className="dt-modal-body">
          <div className="dt-modal-head">
            <h3 className="dt-modal-title">{title}</h3>
            <button className="dt-modal-close" onClick={onClose}>×</button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}