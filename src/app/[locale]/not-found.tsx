import Link from 'next/link';

export default function NotFound() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center'>
        <div className='mb-4'>
          <div className='text-6xl font-bold text-blue-600 mb-2'>404</div>
        </div>

        <h1 className='text-2xl font-semibold text-gray-900 mb-2'>Page Not Found</h1>

        <p className='text-gray-600 mb-6'>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>

        <div className='space-y-3'>
          <Link
            href='/'
            className='block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200'
          >
            Go to homepage
          </Link>

          <Link
            href='/en/blog'
            className='block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200'
          >
            Browse our blog
          </Link>
        </div>
      </div>
    </div>
  );
}
