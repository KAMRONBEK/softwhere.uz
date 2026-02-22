'use client';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { use, useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import { useRouter } from 'next/navigation';

import Hero from '@/components/sections/Hero';

import 'react-toastify/dist/ReactToastify.css';

const EstimatorCTA = dynamic(() => import('@/components/sections/EstimatorCTA'));
const Service = dynamic(() => import('@/components/sections/Service'));
const Discuss = dynamic(() => import('@/components/sections/Discuss'));
const Projects = dynamic(() => import('@/components/sections/Projects'));
const Contact = dynamic(() => import('@/components/sections/Contact'));
const FAQ = dynamic(() => import('@/components/sections/FAQ'));

function Home({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter();
  const { locale } = use(params);
  const { resolvedTheme } = useTheme();
  const [clickCount, setClickCount] = useState(0);
  const [showAdminButton, setShowAdminButton] = useState(false);

  useEffect(() => {
    // @ts-expect-error -- CSS module import has no type declarations
    import('aos/dist/aos.css');
    import('aos').then(AOS => AOS.init());
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
    <main>
      {/* Secret Admin Button */}
      {showAdminButton && (
        <div className='fixed top-4 right-4 z-50 animate-pulse' style={{ zIndex: 9999 }}>
          <button
            onClick={navigateToAdmin}
            className='bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 text-sm font-medium'
            title='Admin Panel Access'
          >
            🔐 Admin
          </button>
        </div>
      )}

      {/* Hidden clickable area for logo clicks */}
      <div onClick={handleLogoClick} className='fixed top-0 left-0 w-20 h-20 z-40 cursor-pointer opacity-0' title='Secret admin access' />

      <Hero />
      <EstimatorCTA />
      <Service />
      <Discuss />
      <Projects />
      <Contact />
      <FAQ />
      <ToastContainer autoClose={3000} closeOnClick theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />
    </main>
  );
}

export default Home;
