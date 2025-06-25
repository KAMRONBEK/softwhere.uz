type PagesStepProps = {
  pageCount: number;
  onPageCountChange: (count: number) => void;
};

export default function PagesStep({ pageCount, onPageCountChange }: PagesStepProps) {
  // Helper function to determine the complexity label based on page count
  const getComplexityLabel = () => {
    if (pageCount <= 5) return 'Simple';
    if (pageCount <= 20) return 'Medium';
    if (pageCount <= 50) return 'Complex';

    return 'Very Complex';
  };

  // Get corresponding color for complexity
  const getComplexityColor = () => {
    if (pageCount <= 5) return 'text-green-600';
    if (pageCount <= 20) return 'text-blue-600';
    if (pageCount <= 50) return 'text-orange-600';

    return 'text-red-600';
  };

  return (
    <div>
      <label htmlFor='pages' className='block mb-2'>
        Number of Pages/Screens
      </label>

      <div className='mb-6'>
        <div className='flex justify-between mb-2'>
          <span className='text-sm text-gray-500'>How many screens do you need?</span>
          <span className={`font-bold ${getComplexityColor()}`}>{getComplexityLabel()}</span>
        </div>

        <input
          id='pages'
          type='range'
          min='1'
          max='100'
          className='w-full accent-orange-500'
          value={pageCount}
          onChange={e => onPageCountChange(Number(e.target.value))}
        />

        <div className='flex justify-between text-sm mt-1'>
          <span>1</span>
          <span className='font-bold'>{pageCount}</span>
          <span>100</span>
        </div>
      </div>

      <div className='p-4 bg-gray-50 rounded-lg border mt-4'>
        <h4 className='font-medium mb-2'>What counts as a screen?</h4>
        <p className='text-sm text-gray-600'>
          Each unique view in your application counts as a screen. For example, a login page, dashboard, profile page, and settings page
          would count as 4 screens.
        </p>
      </div>
    </div>
  );
}
