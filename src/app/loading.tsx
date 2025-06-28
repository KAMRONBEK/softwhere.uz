export default function Loading() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='text-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
        <h2 className='text-lg font-medium text-gray-900 mb-2'>Loading...</h2>
        <p className='text-gray-600'>Please wait while we load the content.</p>
      </div>
    </div>
  );
}
