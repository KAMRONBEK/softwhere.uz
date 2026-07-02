import type { Metadata } from 'next';
import { isAdminAuthenticated } from '@/core/auth';
import { AdminLogin, AdminLogout } from '@/modules/admin/components';

// Server-side gate for the whole admin section. Reading the session cookie makes
// these routes dynamic (never statically cached), which is what we want for admin.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Authoritative check on the server: unauthenticated requests never receive
  // the admin UI (fixes the old client-only gate where pages were reachable).
  if (!(await isAdminAuthenticated())) {
    return <AdminLogin />;
  }

  return (
    <div>
      <div className='flex justify-end items-center px-4 sm:px-6 lg:px-8 h-11 bg-ember-bg border-b border-ember-border'>
        <AdminLogout />
      </div>
      {children}
    </div>
  );
}
