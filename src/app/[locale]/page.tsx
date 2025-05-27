"use client";
import AOS from "aos";
import "aos/dist/aos.css";
import Head from "next/head";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import { useRouter } from "next/navigation";

import Contact from "@/components/sections/Contact";
import Discuss from "@/components/sections/Discuss";
import FAQ from "@/components/sections/FAQ";
import Hero from "@/components/sections/Hero";
import Projects from "@/components/sections/Projects";
import Service from "@/components/sections/Service";

import "react-toastify/dist/ReactToastify.css";

function Home({ params }: { params: { locale: string } }) {
  const router = useRouter();
  const { locale } = params;

  useEffect(() => {
    AOS.init();
  }, []);

  // Secret admin access - invisible button in top-right corner
  const handleSecretClick = () => {
    router.push(`/${locale}/admin/posts`);
  };

  return (
    <main>
      <Head>
        <link rel="shortcut icon" href="/static/logo.svg" />
      </Head>

      {/* Secret Admin Access - Invisible button in top-right corner */}
      <div
        onClick={handleSecretClick}
        style={{
          position: 'fixed',
          top: '0px',
          right: '0px',
          width: '30px',
          height: '30px',
          backgroundColor: 'transparent',
          cursor: 'default',
          zIndex: 9999
        }}
        title=""
      />

      <Hero />
      <Service />
      <Discuss />
      <Projects />
      <Contact />
      <FAQ />
      <ToastContainer autoClose={3000} closeOnClick />
    </main>
  );
}

export default Home;
