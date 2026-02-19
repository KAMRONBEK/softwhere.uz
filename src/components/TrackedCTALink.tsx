'use client';

import { trackEvent } from '@/utils/analytics';
import Link from 'next/link';

interface TrackedCTALinkProps {
  href: string;
  type: 'get_started' | 'view_work';
  slug: string;
  className?: string;
  children: React.ReactNode;
}

export default function TrackedCTALink({ href, type, slug, className, children }: TrackedCTALinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent('cta_click', { type, slug })}
    >
      {children}
    </Link>
  );
}
