import React from 'react';

interface AdminSelectProps {
  label?: string;
  value?: string;
  onChange?: (_e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export const AdminSelect: React.FC<AdminSelectProps> = ({ label, value, onChange, options, className = '' }) => (
  <div className={`flex flex-col gap-2 ${className}`}>
    {label && <label className='text-ember-muted text-sm font-medium leading-4 tracking-tight'>{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className='
        outline-none border border-[color:var(--border-strong)] rounded-[calc(var(--radius)*0.7)] bg-ember-bg min-h-[44px]
        text-ember-text text-lg font-normal leading-6 tracking-tight
        py-2 px-3
        focus:border-ember-accent focus:ring-2 focus:ring-[color:var(--accent)] transition-colors duration-300
      '
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

export default AdminSelect;
