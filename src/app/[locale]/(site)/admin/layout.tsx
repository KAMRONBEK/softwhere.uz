import type { Metadata } from 'next';
import { isAdminAuthenticated } from '@/core/auth';
import { AdminLogin, AdminLogout } from '@/modules/admin/components';

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
    return (
      <main>
        <AdminLogin />
      </main>
    );
  }

  const { locale } = await params;

  return (
    <div>
      <div className='flex justify-between items-center gap-4 px-4 sm:px-6 lg:px-8 min-h-[52px] bg-ember-bg border-b border-ember-border'>
        <nav className='flex items-center gap-4 text-sm'>
          <a
            href={`/${locale}/admin/posts`}
            className='inline-flex items-center min-h-[44px] text-ember-muted hover:text-ember-text transition-colors'
          >
            Posts
          </a>
          <a
            href={`/${locale}/admin/leads`}
            className='inline-flex items-center min-h-[44px] text-ember-muted hover:text-ember-text transition-colors'
          >
            Leads
          </a>
          <a
            href={`/${locale}/admin/ai-demo`}
            className='inline-flex items-center min-h-[44px] text-ember-muted hover:text-ember-text transition-colors'
          >
            AI demo
          </a>
        </nav>
        <AdminLogout />
      </div>
      <main>{children}</main>
    </div>
  );
}
