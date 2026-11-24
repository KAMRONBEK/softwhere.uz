import { toast } from 'react-toastify';
import { postLead } from '@/shared/utils/lead';

export { postLead, type LeadInput } from '@/shared/utils/lead';

interface ResultTexts {
  success: string;
  error: string;
}

/** Sends a lead and turns the loading toast `id` into its result; false when it was not sent (keep the visitor's text). */
export async function sender(id: string, name: string, phone: string, message: string, from: string, texts: ResultTexts): Promise<boolean> {
  const isSent = await postLead({ name, phone, message, from }).catch(() => false);
  toast.update(id, {
    render: isSent ? texts.success : texts.error,
    type: isSent ? 'success' : 'error',
    isLoading: false,
    autoClose: 3000,
  });
  return isSent;
}
