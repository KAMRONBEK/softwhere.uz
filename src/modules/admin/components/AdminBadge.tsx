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
      badgeClasses += ' bg-green-100 text-green-800';
    } else if (status === 'mixed') {
      badgeClasses += ' bg-orange-100 text-orange-800';
    } else {
      badgeClasses += ' bg-yellow-100 text-yellow-800';
    }
  } else if (variant === 'locale') {
    const localeColors = {
      en: 'bg-blue-100 text-blue-800',
      ru: 'bg-red-100 text-red-800',
      uz: 'bg-green-100 text-green-800',
    };

    badgeClasses += ` ${localeColors[locale || 'en']}`;
  } else {
    badgeClasses += ' bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
  }

  return <span className={`${badgeClasses} ${className}`}>{children}</span>;
};

export default AdminBadge;
