import React from 'react';

interface AdminButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  className?: string;
}

export const AdminButton: React.FC<AdminButtonProps> = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  className = '',
}) => {
  const baseClasses =
    'glass px-6 py-3 rounded-lg font-semibold text-sm tracking-tight transition-all duration-300 cursor-pointer hover:-translate-y-0.5';

  const variantClasses = {
    primary: 'text-[var(--accent)]',
    secondary: 'text-gray-900 dark:text-gray-100',
    danger: 'text-red-500',
    success: 'text-green-600',
  };

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} flex items-center justify-center ${variantClasses[variant]} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  );
};

export default AdminButton;
