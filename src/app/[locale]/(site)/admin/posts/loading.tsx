export default function AdminPostsLoading() {
  return (
    <div className='page-layout min-h-screen bg-ember-surface2'>
      <div className='bg-ember-surface border-b border-ember-border'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-6'>
            <div className='space-y-2'>
              <div className='h-8 bg-[rgba(255,150,90,0.1)] rounded w-56 animate-pulse' />
              <div className='h-4 bg-[rgba(255,150,90,0.1)] rounded w-72 animate-pulse' />
            </div>
            <div className='h-10 bg-[rgba(255,150,90,0.1)] rounded w-44 animate-pulse' />
          </div>
        </div>
      </div>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='bg-ember-surface rounded-xl shadow-sm border border-ember-border overflow-hidden'>
          <div className='px-6 py-4 border-b border-ember-border bg-ember-surface2'>
            <div className='h-6 bg-[rgba(255,150,90,0.1)] rounded w-32 animate-pulse' />
          </div>
          <div className='divide-y divide-ember-border'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='p-6 space-y-4'>
                <div className='flex justify-between'>
                  <div className='h-5 bg-[rgba(255,150,90,0.1)] rounded w-48 animate-pulse' />
                  <div className='flex space-x-2'>
                    <div className='h-8 bg-[rgba(255,150,90,0.1)] rounded w-24 animate-pulse' />
                    <div className='h-8 bg-[rgba(255,150,90,0.1)] rounded w-24 animate-pulse' />
                  </div>
                </div>
                <div className='space-y-3'>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className='flex items-center justify-between p-4 bg-ember-surface2 rounded-lg'>
                      <div className='flex items-center space-x-3 flex-1'>
                        <div className='h-6 bg-[rgba(255,150,90,0.1)] rounded w-10 animate-pulse' />
                        <div className='h-5 bg-[rgba(255,150,90,0.1)] rounded w-64 animate-pulse' />
                      </div>
                      <div className='flex space-x-2'>
                        <div className='h-8 bg-[rgba(255,150,90,0.1)] rounded w-20 animate-pulse' />
                        <div className='h-8 bg-[rgba(255,150,90,0.1)] rounded w-16 animate-pulse' />
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
