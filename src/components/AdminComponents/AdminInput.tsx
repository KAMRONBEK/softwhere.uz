import React from 'react';

interface AdminInputProps {
  label?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const AdminInput: React.FC<AdminInputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  required = false,
}) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    {label && (
      <label className='text-gray-500 text-sm font-medium leading-4 tracking-tight'>
        {label}
      </label>
    )}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className='
        outline-none border-b border-gray-300 
        text-gray-900 text-lg font-normal leading-6 tracking-tight
        py-2 px-0 bg-transparent
        focus:border-[#fe4502] transition-colors duration-300
      '
    />
  </div>
);

export default AdminInput;
