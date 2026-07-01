import React from 'react';

interface AdminSectionTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const AdminSectionTitle: React.FC<AdminSectionTitleProps> = ({ children, className = '' }) => (
  <h2 className={`text-4xl font-bold font-display text-ember-text leading-tight tracking-wide mb-6 ${className}`}>{children}</h2>
);

export default AdminSectionTitle;
