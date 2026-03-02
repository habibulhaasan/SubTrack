import { AuthProvider } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Shell from '@/components/Shell';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'DonateTrack — Donation Management',
  description: 'Manage donations, members and funds across your organization',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          <Sidebar />
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
