export default function HomeLoading() {
  return (
    <main className='min-h-screen'>
      <section className='relative h-[80vh] bg-gray-100 animate-pulse' />
      <div className='container py-16 space-y-8'>
        <div className='h-8 bg-gray-200 rounded w-1/3 mx-auto animate-pulse' />
        <div className='grid md:grid-cols-3 gap-8'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='h-64 bg-gray-200 rounded-xl animate-pulse' />
          ))}
        </div>
      </div>
    </main>
  );
}
