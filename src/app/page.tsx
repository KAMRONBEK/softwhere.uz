import Discuss from "@/components/sections/Discuss";
import FAQ from "@/components/sections/FAQ";
import Hero from "@/components/sections/Hero";
import Projects from "@/components/sections/Projects";
import Service from "@/components/sections/Service";
import Contact from "@/components/sections/Contact";

export default function Home() {
    return (
        <main>
            <Hero/>
            <Service/>
            <Discuss/>
            <Projects/>
            <Contact/>
            <FAQ/>
        </main>
    );
}
