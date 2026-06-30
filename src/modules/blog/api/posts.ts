import { apiClient } from '@/core/http';

/** Client-side blog API calls (the generator in ./generator.ts is server-only). */

/** Find the sibling post in another locale for the same generation group. */
export async function getRelatedPost(generationGroupId: string, locale: string) {
  return apiClient.get<{ post: { slug: string; locale: string } }>(
    `/api/blog/posts/related?generationGroupId=${generationGroupId}&locale=${locale}`
  );
}
