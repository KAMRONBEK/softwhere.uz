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
    'px-6 py-3 rounded-[calc(var(--radius)*0.7)] font-semibold text-sm tracking-tight transition-colors duration-200 cursor-pointer min-h-[44px]';

  const variantClasses = {
    primary: 'bg-ember-accent text-[color:var(--on-accent)] font-semibold',
    secondary: 'bg-ember-surface border border-ember-border text-ember-text hover:border-ember-accent',
    danger:
      'bg-transparent border border-[color:var(--accent)] text-ember-text hover:bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)]',
    success: 'bg-ember-accent text-[color:var(--on-accent)] font-semibold',
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
