import type { Metadata } from 'next';
import { AdminAuthGate } from '@/components/AdminComponents';

// Server layout so it can carry noindex metadata for the whole admin section.
// AdminAuthGate is a client component rendered from this server boundary.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthGate>{children}</AdminAuthGate>;
}
