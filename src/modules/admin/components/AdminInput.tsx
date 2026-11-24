import React from 'react';

interface AdminInputProps {
  label?: string;
  type?: string;
  value?: string;
  onChange?: (_e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  children?: React.ReactNode;
}

const AdminInput: React.FC<AdminInputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  required = false,
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && <label className='text-ember-muted text-sm font-medium leading-4 tracking-tight'>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className='
          outline-none border border-[color:var(--border-strong)] rounded-[calc(var(--radius)*0.7)] bg-ember-bg min-h-[44px]
          text-ember-text placeholder:text-ember-muted text-lg font-normal leading-6 tracking-tight
          py-2 px-3
          focus:border-ember-accent focus:ring-2 focus:ring-[color:var(--accent)] transition-colors duration-300
        '
      />
    </div>
  );
};

export default AdminInput;
