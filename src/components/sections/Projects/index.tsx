import React from "react";
import css from "./style.module.css";
import SectionText from "@/components/SectionTitle";

function Projects() {
    
  return (
    <section className={css.section}>
      <div className="container">
        <SectionText className="w-1/2">
          Developed more than <span>100</span> projects in <span>15</span>
          industries
        </SectionText>
      </div>
    </section>
  );
}

export default Projects;
