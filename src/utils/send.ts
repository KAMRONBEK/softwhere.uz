import { toast } from 'react-toastify';

const sender = async function (
  id: string,
  name: string,
  phone: string,
  message: string,
  from: string
) {
  const text =
    `<b>Message from softwhere.uz contact form ${from}:</b>\n` +
    `<b>\nName:</b> ${name}\n<b>Phone Number:</b> ${phone}\n<b>Message:</b> ${
      message
    }`;

  await fetch(
    `https://api.telegram.org/bot${
      process.env.NEXT_PUBLIC_TG_BOT_TOKEN
    }/sendMessage?parse_mode=html`,
    {
      headers: {
        'Content-Type': 'application/json',
        'cache-control': 'no-cache',
      },
      method: 'POST',
      body: JSON.stringify({
        chat_id: process.env.NEXT_PUBLIC_TG_CHAT_ID,
        text,
      }),
    }
  )
    .then(res => {
      if (res.status === 200) {
        toast.update(id, {
          render: 'Message sent successfully!',
          type: 'success',
          isLoading: false,
          autoClose: 3000,
        });
      }
    })
    .catch(() => {
      toast.update(id, {
        render: 'Something went wrong',
        type: 'error',
        isLoading: false,
        autoClose: 3000,
      });
    });
};

export { sender };
