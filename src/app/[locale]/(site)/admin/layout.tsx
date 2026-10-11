import type { Metadata } from 'next';
import { isAdminAuthenticated } from '@/core/auth';
import { AdminLogin, AdminLogout } from '@/modules/admin/components';
import { jetbrainsMono } from '@/shared/fonts';

// Server-side gate for the whole admin section. Reading the session cookie makes
// these routes dynamic (never statically cached), which is what we want for admin.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  // Authoritative check on the server: unauthenticated requests never receive
  // the admin UI (fixes the old client-only gate where pages were reachable).
  if (!(await isAdminAuthenticated())) {
    return <AdminLogin />;
  }

  const { locale } = await params;

  return (
    <div className={jetbrainsMono.variable}>
      <div className='flex justify-between items-center px-4 sm:px-6 lg:px-8 h-11 bg-ember-bg border-b border-ember-border'>
        <nav className='flex items-center gap-4 text-sm'>
          <a href={`/${locale}/admin/posts`} className='text-ember-muted hover:text-ember-text transition-colors'>
            Posts
          </a>
          <a href={`/${locale}/admin/leads`} className='text-ember-muted hover:text-ember-text transition-colors'>
            Leads
          </a>
        </nav>
        <AdminLogout />
      </div>
      {children}
    </div>
  );
}
