import React from 'react';

interface AdminTableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export const AdminTable: React.FC<AdminTableProps> = ({ headers, children, className = '' }) => (
  <div className={`bg-ember-surface border border-ember-border rounded-xl shadow-lg overflow-hidden ${className}`}>
    <div className='overflow-x-auto'>
      <table className='min-w-full divide-y divide-ember-border'>
        <thead className='bg-ember-surface2'>
          <tr>
            {headers.map((header, index) => (
              <th key={index} className='px-6 py-4 text-left text-xs font-medium text-ember-muted uppercase tracking-wider'>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='bg-ember-surface divide-y divide-ember-border'>{children}</tbody>
      </table>
    </div>
  </div>
);

export default AdminTable;
