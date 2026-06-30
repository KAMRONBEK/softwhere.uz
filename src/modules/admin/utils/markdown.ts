import { escapeHtml } from '@/shared/utils/security';

// Markdown to HTML converter (simple version).
// IMPORTANT: escape the raw content FIRST so any HTML in the post (e.g. an
// AI-generated `<img onerror=...>`) is rendered inert text. The markdown tags
// below are added after escaping, so formatting still works. Without this the
// preview modal is a stored-XSS sink in the admin's authenticated session.
export const markdownToHtml = (markdown: string) => {
  return escapeHtml(markdown)
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-gray-900 mt-8 mb-6">$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(.*)\*/gim, '<em class="italic">$1</em>')
    .replace(/^\- (.*$)/gim, '<li class="ml-4 mb-1">• $1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 mb-1 list-decimal">$1</li>')
    .replace(/\n\n/gim, '</p><p class="mb-4 text-gray-700 leading-relaxed">')
    .replace(/\n/gim, '<br>')
    .replace(/^(.*)$/gim, '<p class="mb-4 text-gray-700 leading-relaxed">$1</p>');
};
