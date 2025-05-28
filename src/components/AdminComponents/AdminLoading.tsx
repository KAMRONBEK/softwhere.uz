import React from 'react';

interface AdminLoadingProps {
  message?: string;
}

export const AdminLoading: React.FC<AdminLoadingProps> = ({
  message = 'Loading...',
}) => (
  <div className='admin-layout flex items-center justify-center'>
    <div className='text-center'>
      <div className='animate-spin rounded-full h-12 w-12 border-4 border-solid border-[#fe4502] border-r-transparent mx-auto'></div>
      <p className='mt-4 text-gray-600 text-lg'>{message}</p>
    </div>
  </div>
);

export default AdminLoading;
