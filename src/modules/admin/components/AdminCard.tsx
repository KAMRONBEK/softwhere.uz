import React from 'react';

interface AdminCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const AdminCard: React.FC<AdminCardProps> = ({ children, className = '', hover = false }) => (
  <div
    className={`
    bg-ember-surface border border-ember-border rounded-[var(--radius)] p-6
    ${hover ? 'hover:border-ember-accent transition-colors duration-200' : ''}
    ${className}
  `}
  >
    {children}
  </div>
);

export default AdminCard;
