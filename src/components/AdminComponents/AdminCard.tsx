import React from 'react';

interface AdminCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const AdminCard: React.FC<AdminCardProps> = ({
  children,
  className = '',
  hover = false,
}) => (
  <div
    className={`
    bg-white rounded-xl p-6 
    shadow-lg border border-gray-100
    ${hover ? 'hover:shadow-xl hover:-translate-y-1 transition-all duration-300' : ''}
    ${className}
  `}
  >
    {children}
  </div>
);

export default AdminCard;
