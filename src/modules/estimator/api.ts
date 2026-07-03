import { apiClient, type ApiResponse } from '@/core/http';
import type { AiRefinement, EstimateApiResponse, EstimateLeadPayload, EstimatorInput } from '@/modules/estimator/types';

const ESTIMATE_TIMEOUT_MS = 60_000;

/**
 * Request the server-verified estimate + AI refinement. The AI call can take
 * ~30–45s (Kimi K2.6 at ~43 tok/s), far beyond apiClient's 10s default, so
 * this uses a dedicated fetch with its own timeout. The UI shows the local
 * formula instantly and treats this response as enrichment.
 */
export async function getEstimate(input: EstimatorInput, locale: string, signal?: AbortSignal): Promise<ApiResponse<EstimateApiResponse>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ESTIMATE_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort);

  try {
    const response = await fetch('/api/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, locale }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as { success?: boolean; data?: EstimateApiResponse; error?: string };

    if (response.ok && payload.success && payload.data) {
      return { success: true, data: payload.data };
    }
    return { success: false, error: payload.error ?? `HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

/** Send the estimate + contact details to the agency (DB + Telegram). */
export async function submitEstimateLead(payload: EstimateLeadPayload & { ai?: AiRefinement | null }): Promise<ApiResponse<void>> {
  try {
    const raw = await apiClient.post('/api/estimate/lead', payload);
    if (raw.success) return { success: true };
    return { success: false, error: raw.error ?? 'Unexpected response' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
