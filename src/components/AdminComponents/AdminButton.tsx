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
  className = ''
}) => {
  const baseClasses = 'px-6 py-3 rounded-lg font-semibold text-sm tracking-tight transition-all duration-300 border-none cursor-pointer';
  
  const variantClasses = {
    primary: 'bg-[#fe4502] text-white hover:bg-[#ff5f24] active:bg-[#fe4502aa]',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
    success: 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
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