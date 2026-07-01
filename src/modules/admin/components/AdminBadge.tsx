import React from 'react';

interface AdminBadgeProps {
  children: React.ReactNode;
  variant?: 'status' | 'locale' | 'default';
  status?: 'draft' | 'published' | 'mixed';
  locale?: 'en' | 'ru' | 'uz';
  className?: string;
}

export const AdminBadge: React.FC<AdminBadgeProps> = ({ children, variant = 'default', status, locale, className = '' }) => {
  let badgeClasses = 'px-3 py-1 text-xs font-medium rounded-full';

  if (variant === 'status') {
    if (status === 'published') {
      badgeClasses += ' bg-[rgba(34,197,94,0.15)] text-green-400';
    } else if (status === 'mixed') {
      badgeClasses += ' bg-[rgba(249,115,22,0.15)] text-orange-400';
    } else {
      badgeClasses += ' bg-ember-surface2 text-ember-muted border border-ember-border';
    }
  } else if (variant === 'locale') {
    const localeColors = {
      en: 'bg-[rgba(59,130,246,0.15)] text-blue-400',
      ru: 'bg-[rgba(239,68,68,0.15)] text-red-400',
      uz: 'bg-[rgba(34,197,94,0.15)] text-green-400',
    };

    badgeClasses += ` ${localeColors[locale || 'en']}`;
  } else {
    badgeClasses += ' bg-ember-surface2 text-ember-muted border border-ember-border';
  }

  return <span className={`${badgeClasses} ${className}`}>{children}</span>;
};

export default AdminBadge;
