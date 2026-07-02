'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const ToastContainer = dynamic(() => import('react-toastify').then(m => m.ToastContainer), { ssr: false });

function HomeClientLayer({ locale }: { locale: string }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [clickCount, setClickCount] = useState(0);
  const [showAdminButton, setShowAdminButton] = useState(false);

  useEffect(() => {
    // @ts-expect-error -- CSS module import has no type declarations
    import('aos/dist/aos.css');
    import('aos').then(AOS => AOS.init());
    // Toast styles are only needed after a form submit — keep them out of the
    // render-blocking CSS bundle.
    // @ts-expect-error -- CSS import has no type declarations
    import('react-toastify/dist/ReactToastify.css');
  }, []);

  // Secret click sequence on logo (5 clicks within 3 seconds)
  const handleLogoClick = () => {
    const newCount = clickCount + 1;

    setClickCount(newCount);

    if (newCount === 5) {
      setShowAdminButton(true);
      setClickCount(0);
      setTimeout(() => setShowAdminButton(false), 10000); // Hide after 10 seconds
    }

    // Reset count after 3 seconds
    setTimeout(() => {
      setClickCount(0);
    }, 3000);
  };

  const navigateToAdmin = () => {
    router.push(`/${locale}/admin/posts`);
  };

  return (
    <>
      {/* Secret Admin Button */}
      {showAdminButton && (
        <div className='fixed top-20 right-4 z-50 animate-pulse' style={{ zIndex: 9999 }}>
          <button
            onClick={navigateToAdmin}
            className='bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 text-sm font-medium'
            title='Admin Panel Access'
          >
            🔐 Admin
          </button>
        </div>
      )}

      {/* Hidden clickable area (top-left corner). z-index sits ABOVE the fixed
          header (z-999) so the secret 5-click sequence isn't swallowed by it. */}
      <div
        onClick={handleLogoClick}
        className='fixed top-0 left-0 w-20 h-20 cursor-pointer opacity-0'
        style={{ zIndex: 1000 }}
        title='Secret admin access'
      />

      <ToastContainer autoClose={3000} closeOnClick theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />
    </>
  );
}

export default HomeClientLayer;
