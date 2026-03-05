// src/components/Modal.js
'use client';
import { useEffect } from 'react';

/**
 * Universal Modal component.
 * Mobile  → full-width bottom sheet sliding up
 * Desktop → centered dialog (true viewport center, accounts for 240px sidebar)
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

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <style>{`
        /* ── Backdrop with blur ────────────────────── */
        .dt-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 9000;
          animation: dtFadeIn .18s ease both;
        }
        @keyframes dtFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* ── Dialog — mobile bottom sheet ─────────── */
        .dt-modal-dialog {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 92dvh;
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
          flex-shrink: 0;
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
          transition: color 0.15s;
        }
        .dt-modal-close:hover { color: #475569; }

        /* ── Dialog — desktop centered ──────────────
           True centering in the content area:
           - The content area starts at 240px (sidebar width)
           - Content area width = 100vw - 240px
           - Center of content area = 240px + (100vw - 240px) / 2
                                    = 240px + 50vw - 120px
                                    = 50vw + 120px
           - We place left at that center point, then pull back 50% of dialog width
             via transform: translateX(-50%)
           - For vertical: top:50%, transform: translateY(-50%)
        ──────────────────────────────────────────── */
        @media (min-width: 769px) {
          .dt-modal-dialog {
            /* Position */
            top: 50%;
            bottom: auto;
            left: calc(50vw + 120px);
            right: auto;

            /* Size */
            width: 520px;
            max-width: calc(100vw - 280px);
            max-height: 88vh;

            /* Shape */
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0,0,0,0.08);

            /* Center precisely in content area */
            transform: translate(-50%, -50%);

            animation: dtPop .2s cubic-bezier(.32, 1, .32, 1) both;
          }

          .dt-modal-dialog.dt-modal-wide {
            width: 660px;
            max-width: calc(100vw - 280px);
          }

          @keyframes dtPop {
            from {
              opacity: 0;
              transform: translate(-50%, -48%) scale(.96);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
          }

          .dt-modal-handle { display: none; }
          .dt-modal-body   { padding: 24px 32px 36px; }
        }

        /* ── Super-wide screens — cap sidebar offset ─
           On very large screens (>1400px) keep dialog
           from drifting too far right.
        ──────────────────────────────────────────── */
        @media (min-width: 1400px) {
          .dt-modal-dialog {
            left: calc(120px + 50%);
          }
        }
      `}</style>

      {/* Backdrop — clicking closes modal */}
      <div className="dt-modal-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Dialog — clicks don't bubble to backdrop */}
      <div
        className={`dt-modal-dialog${wide ? ' dt-modal-wide' : ''}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dt-modal-handle" />
        <div className="dt-modal-body">
          <div className="dt-modal-head">
            <h3 className="dt-modal-title">{title}</h3>
            <button className="dt-modal-close" onClick={onClose} aria-label="Close">×</button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}