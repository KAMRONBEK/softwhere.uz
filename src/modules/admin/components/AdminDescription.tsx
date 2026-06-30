import React from 'react';

interface AdminDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const AdminDescription: React.FC<AdminDescriptionProps> = ({ children, className = '' }) => (
  <p className={`text-gray-900 text-base font-medium leading-5 tracking-tight ${className}`}>{children}</p>
);

export default AdminDescription;
