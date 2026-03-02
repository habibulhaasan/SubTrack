'use client';
import { usePathname } from 'next/navigation';

const PUBLIC = ['/', '/login', '/register', '/forgot-password', '/create-org', '/select-org', '/join', '/pending-approval'];

export default function Shell({ children }) {
  const pathname = usePathname();
  const isPublic = PUBLIC.some(r => pathname === r || pathname.startsWith(r + '/'));
  const isSuperAdmin = pathname.startsWith('/superadmin');
  const needsSidebarMargin = !isPublic;

  return (
    <>
      <style>{`
        @media (min-width: 769px) {
          .shell-main { margin-left: ${needsSidebarMargin ? '240px' : '0'}; }
        }
        @media (max-width: 768px) {
          .shell-main { padding-top: ${needsSidebarMargin ? '56px' : '0'}; }
        }
      `}</style>
      <main className="shell-main" style={{ minHeight: '100vh' }}>
        {children}
      </main>
    </>
  );
}
