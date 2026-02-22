export default function AdminPostsLoading() {
  return (
    <div className='page-layout min-h-screen bg-gray-50 dark:bg-gray-900'>
      <div className='bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-6'>
            <div className='space-y-2'>
              <div className='h-8 bg-gray-200 dark:bg-gray-700 rounded w-56 animate-pulse' />
              <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-72 animate-pulse' />
            </div>
            <div className='h-10 bg-gray-200 dark:bg-gray-700 rounded w-44 animate-pulse' />
          </div>
        </div>
      </div>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'>
            <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse' />
          </div>
          <div className='divide-y divide-gray-200 dark:divide-gray-700'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='p-6 space-y-4'>
                <div className='flex justify-between'>
                  <div className='h-5 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse' />
                  <div className='flex space-x-2'>
                    <div className='h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse' />
                    <div className='h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse' />
                  </div>
                </div>
                <div className='space-y-3'>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg'>
                      <div className='flex items-center space-x-3 flex-1'>
                        <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-10 animate-pulse' />
                        <div className='h-5 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse' />
                      </div>
                      <div className='flex space-x-2'>
                        <div className='h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse' />
                        <div className='h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse' />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
