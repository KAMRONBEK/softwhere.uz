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
    'px-6 py-3 rounded-lg font-semibold text-sm tracking-tight transition-all duration-300 cursor-pointer hover:-translate-y-0.5';

  const variantClasses = {
    primary: 'bg-ember-accent text-[#0a0705] font-semibold hover:shadow-[0_0_20px_var(--glow)]',
    secondary: 'bg-ember-surface border border-ember-border text-ember-text hover:border-ember-accent',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-ember-accent text-[#0a0705] font-semibold hover:shadow-[0_0_20px_var(--glow)]',
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
