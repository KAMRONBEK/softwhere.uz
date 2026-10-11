import { toast } from 'react-toastify';
import { postLead } from '@/shared/utils/lead';

export { postLead, type LeadInput } from '@/shared/utils/lead';

const sender = async function (id: string, name: string, phone: string, message: string, from: string) {
  try {
    const isSent = await postLead({ name, phone, message, from });

    if (isSent) {
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
