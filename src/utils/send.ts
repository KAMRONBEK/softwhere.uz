import { toast } from 'react-toastify';
import { trackEvent } from '@/utils/analytics';

const FORM_SOURCE_MAP: Record<string, 'hero' | 'discuss' | 'contact'> = {
  consultation: 'hero',
  discuss: 'discuss',
  '': 'contact',
};

const sender = async function (id: string, name: string, phone: string, message: string, from: string) {
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, message, from }),
    });

    if (res.ok) {
      trackEvent('form_submit', { source: FORM_SOURCE_MAP[from] ?? 'contact' });
      toast.update(id, {
        render: 'Message sent successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 3000,
      });
    } else {
      toast.update(id, {
        render: 'Something went wrong',
        type: 'error',
        isLoading: false,
        autoClose: 3000,
      });
    }
  } catch {
    toast.update(id, {
      render: 'Something went wrong',
      type: 'error',
      isLoading: false,
      autoClose: 3000,
    });
  }
};

export { sender };
