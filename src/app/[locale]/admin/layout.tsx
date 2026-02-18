'use client';

import { AdminAuthGate } from '@/components/AdminComponents';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthGate>{children}</AdminAuthGate>;
}
