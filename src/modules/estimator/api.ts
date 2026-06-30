import { apiClient, type ApiResponse } from '@/core/http';
import type { EstimateResult, EstimatorInput } from '@/modules/estimator/types';

type EstimateData = EstimateResult & { source: 'ai' | 'formula'; reasoning?: string };

/**
 * Request a project cost estimate. The Next.js route returns { success, data },
 * which apiClient.post wraps again — so we unwrap one level for the UI.
 */
export async function getEstimate(input: EstimatorInput): Promise<ApiResponse<EstimateData>> {
  try {
    const raw = await apiClient.post('/api/estimate', input);

    if (raw.success && raw.data && 'data' in (raw.data as any)) {
      return { success: true, data: (raw.data as any).data } as ApiResponse<EstimateData>;
    }

    return raw as ApiResponse<EstimateData>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
