export default function BlogLoading() {
  return (
    <div className='page-layout' style={{ backgroundColor: 'var(--gray-100)' }}>
      <div className='container py-20'>
        <header className='mb-12 text-center'>
          <div className='h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 mx-auto mb-6 animate-pulse' />
          <div className='h-5 bg-gray-200 dark:bg-gray-700 rounded w-96 max-w-full mx-auto animate-pulse' />
        </header>
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-8'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className='bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700'
            >
              <div className='h-48 bg-gray-200 dark:bg-gray-700 animate-pulse' />
              <div className='p-6 space-y-3'>
                <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse' />
                <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse' />
                <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse' />
                <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse' />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
