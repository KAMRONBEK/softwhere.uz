import SectionText from "@/components/SectionTitle";
import ProjectSlider from "./components/ProjectSlider";
import css from "./style.module.css";
import {useTranslations} from "use-intl";

function Projects() {
  const t = useTranslations("projects")
  return (
    <section className={css.section} id="portfolio">
      <div className="container">
        <SectionText>{t("title")}</SectionText>
        <SectionText className="mt-6 lg:w-1/2" type="desc">
          {t("description")}
        </SectionText>
        <ProjectSlider />
      </div>
    </section>
  );
}

export default Projects;
