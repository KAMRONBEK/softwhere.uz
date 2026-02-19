import { track } from '@vercel/analytics';

type EventMap = {
  form_submit: { source: 'hero' | 'discuss' | 'contact'; locale?: string };
  language_switch: { from: string; to: string };
  blog_post_view: { slug: string; category?: string; locale: string; readingTime: number };
  blog_category_filter: { category: string };
  cta_click: { type: 'get_started' | 'view_work'; slug: string };
  faq_toggle: { question: string };
  project_view: { project: string };
  scroll_to_top: Record<string, never>;
  external_link_click: { type: 'phone' | 'email'; source: string };
};

export function trackEvent<K extends keyof EventMap>(
  name: K,
  ...args: EventMap[K] extends Record<string, never> ? [] : [EventMap[K]]
) {
  try {
    const props = args[0];
    if (props && Object.keys(props).length > 0) {
      track(name, props as Record<string, string | number | boolean>);
    } else {
      track(name);
    }
  } catch {
    // Silently fail - analytics should never break the app
  }
}
