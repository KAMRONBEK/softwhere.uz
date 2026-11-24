import React from 'react';

interface AdminBadgeProps {
  children: React.ReactNode;
  variant?: 'status' | 'locale' | 'default';
  status?: 'draft' | 'published' | 'mixed';
  locale?: 'en' | 'ru' | 'uz';
  className?: string;
}

export const AdminBadge: React.FC<AdminBadgeProps> = ({ children, variant = 'default', status, className = '' }) => {
  let badgeClasses = 'px-3 py-1 text-xs font-medium rounded-[var(--radius)]';

  if (variant === 'status') {
    if (status === 'published') {
      badgeClasses += ' bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] text-ember-text';
    } else if (status === 'mixed') {
      badgeClasses += ' border border-dashed border-[color:var(--border-strong)] text-ember-text';
    } else {
      badgeClasses += ' bg-ember-surface2 text-ember-muted border border-ember-border';
    }
  } else if (variant === 'locale') {
    badgeClasses += ' font-mono bg-ember-surface text-ember-text border border-[color:var(--border-strong)]';
  } else {
    badgeClasses += ' bg-ember-surface2 text-ember-muted border border-ember-border';
  }

  return <span className={`${badgeClasses} ${className}`}>{children}</span>;
};

export default AdminBadge;
