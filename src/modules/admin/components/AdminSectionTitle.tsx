import React from 'react';

interface AdminSectionTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const AdminSectionTitle: React.FC<AdminSectionTitleProps> = ({ children, className = '' }) => (
  <h2
    className={`text-[length:calc(2.25rem*var(--display-scale,1))] leading-tight [font-weight:var(--display-weight)] tracking-[var(--display-tracking)] text-ember-text font-display mb-6 ${className}`}
  >
    {children}
  </h2>
);

export default AdminSectionTitle;
