"use client";
import AOS from "aos";
import "aos/dist/aos.css";
import Head from "next/head";
import {useEffect} from "react";
import {ToastContainer} from "react-toastify";

import Contact from "@/components/sections/Contact";
import Discuss from "@/components/sections/Discuss";
import FAQ from "@/components/sections/FAQ";
import Hero from "@/components/sections/Hero";
import Projects from "@/components/sections/Projects";
import Service from "@/components/sections/Service";

import "react-toastify/dist/ReactToastify.css";

function Home() {
  useEffect(() => {
    AOS.init();
  }, []);

  return (
    <main>
      <Head>
        <link rel="shortcut icon" href="/static/logo.svg" />
      </Head>
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
