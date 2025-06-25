import Button from '@/components/Button';
import type { EstimateResult } from '@/types/estimator';
import { useEffect } from 'react';

type ResultDisplayProps = {
  result: EstimateResult | null;
  source: 'ai' | 'formula' | null;
  loading: boolean;
  error: string;
  aiReasoning?: string;
  onReset: () => void;
};

export default function ResultDisplay({ result, source, loading, error, aiReasoning, onReset }: ResultDisplayProps) {
  // Debug the incoming props
  useEffect(() => {
    console.log('ResultDisplay received result:', result);
  }, [result]);

  // Format the cost values for display
  const formatCurrency = (value: number | undefined): string => {
    if (value === undefined) return '0';

    return value.toLocaleString();
  };

  return (
    <div className='mt-10 border-t pt-6'>
      <h2 className='text-xl font-semibold mb-2'>
        {source === 'ai' ? '🤖 AI-Powered Estimate' : source === 'formula' ? '🔢 Formula-Based Estimate' : '⚡ Live Preview'}
      </h2>

      {loading ? (
        <div className='flex flex-col items-center py-8'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4'></div>
          <p>Generating your estimate...</p>
        </div>
      ) : (
        <div>
          {error && (
            <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4'>
              <p className='text-yellow-700 text-sm'>{error}</p>
            </div>
          )}

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-4'>
            <div className='p-4 border rounded-lg hover:shadow-sm transition-shadow'>
              <p className='text-sm text-gray-500'>Development Cost</p>
              <p className='text-2xl font-bold'>${formatCurrency(result?.developmentCost)}</p>
            </div>

            <div className='p-4 border rounded-lg hover:shadow-sm transition-shadow'>
              <p className='text-sm text-gray-500'>Timeframe</p>
              <p className='text-2xl font-bold'>{result?.deadlineWeeks || 0} weeks</p>
            </div>

            <div className='p-4 border rounded-lg hover:shadow-sm transition-shadow'>
              <p className='text-sm text-gray-500'>Support (Year 1)</p>
              <p className='text-2xl font-bold'>${formatCurrency(result?.supportCost)}</p>
            </div>
          </div>

          {source === 'ai' && aiReasoning && (
            <div className='mt-6 p-4 bg-gray-50 rounded-lg border'>
              <h3 className='font-medium mb-2'>AI Analysis</h3>
              <p className='text-gray-700'>{aiReasoning}</p>
            </div>
          )}

          <div className='mt-6 flex flex-wrap gap-3'>
            <Button onClick={onReset}>Start Over</Button>
            <Button className='bg-green-600'>Contact Us</Button>
            {source === 'ai' && (
              <Button className='bg-gray-700'>
                <span className='flex items-center'>
                  <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4 mr-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                    />
                  </svg>
                  Export PDF
                </span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
