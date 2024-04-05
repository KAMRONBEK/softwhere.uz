"use client";
import React, {useEffect} from "react";

import Discuss from "@/components/sections/Discuss";
import FAQ from "@/components/sections/FAQ";
import Hero from "@/components/sections/Hero";
import Projects from "@/components/sections/Projects";
import Service from "@/components/sections/Service";
import Contact from "@/components/sections/Contact";

import AOS from "aos";
import "aos/dist/aos.css";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function Home() {
  useEffect(() => {
    AOS.init();
  }, []);

  return (
    <main>
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