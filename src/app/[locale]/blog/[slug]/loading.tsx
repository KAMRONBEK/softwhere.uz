export default function BlogPostLoading() {
  return (
    <div className='page-layout min-h-screen' style={{ backgroundColor: 'var(--gray-100)' }}>
      <nav className='bg-white border-b border-gray-200'>
        <div className='container py-4'>
          <div className='h-4 bg-gray-200 rounded w-48 animate-pulse' />
        </div>
      </nav>
      <header className='bg-white border-b border-gray-200'>
        <div className='container py-4'>
          <div className='h-5 bg-gray-200 rounded w-32 animate-pulse' />
        </div>
      </header>
      <div className='w-full h-64 md:h-96 bg-gray-200 animate-pulse' />
      <main className='container py-12'>
        <div className='bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden'>
          <div className='p-8 md:p-12 space-y-6'>
            <div className='text-center space-y-4'>
              <div className='h-10 bg-gray-200 rounded w-3/4 mx-auto animate-pulse' />
              <div className='flex justify-center gap-4'>
                <div className='h-4 bg-gray-200 rounded w-32 animate-pulse' />
                <div className='h-4 bg-gray-200 rounded w-24 animate-pulse' />
              </div>
            </div>
            {[95, 88, 100, 92, 86, 97, 90, 94].map((w, i) => (
              <div key={i} className='h-4 bg-gray-200 rounded animate-pulse' style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
