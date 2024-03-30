import SectionText from "@/components/SectionTitle";
import ProjectSlider from "./components/ProjectSlider";
import css from "./style.module.css";

function Projects() {
  return (
    <section className={css.section} id="portfolio">
      <div className="container">
        <SectionText>Projects we are proud of</SectionText>
        <SectionText className="mt-6 w-1/2" type="desc">
          Our software development company is truly proud of the wonderful
          clients we have worked with. We enjoy a long-term partnership
        </SectionText>
        <ProjectSlider />
      </div>
    </section>
  );
}

export default Projects;
