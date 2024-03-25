import React from "react";
import Image from "next/image";
import css from "./style.module.css";
import SectionText from "@/components/SectionTitle";
import SocialMediaIcon from "../../../../public/icons/social-media.svg";
import FitnessIcon from "../../../../public/icons/ball_outline_24.svg";
import BankIcon from "../../../../public/icons/bank_outline_24.svg";
import ProjectSlider from "./components/ProjectSlider";

function Projects() {
  const data = [
    {
      icon: SocialMediaIcon,
      title: "Social media",
    },
    {
      icon: FitnessIcon,
      title: "Fitness and sport",
    },
    {
      icon: BankIcon,
      title: "Bank",
    },
    {
      icon: BankIcon,
      title: "Construction",
    },
    {
      icon: BankIcon,
      title: "Game projects",
    },
    {
      icon: BankIcon,
      title: "Education",
    },
    {
      icon: BankIcon,
      title: "Auto, transport",
    },
    {
      icon: BankIcon,
      title: "Medicine, health",
    },
    {
      icon: BankIcon,
      title: "Restaurants, food delivery",
    },
    {
      icon: BankIcon,
      title: "Marketplaces",
    },
    {
      icon: BankIcon,
      title: "AR technology",
    },
    {
      icon: BankIcon,
      title: "TV series",
    },
    {
      icon: BankIcon,
      title: "Startups",
    },
    {
      icon: BankIcon,
      title: "Religion",
    },
    {
      icon: BankIcon,
      title: "Online cources",
    },
  ];

  return (
    <section className={css.section}>
      <div className="container">
        <SectionText className="w-1/2">
          Developed more than <span>100</span> projects in <span>15</span>
          industries
        </SectionText>
        <ul className="grid grid-cols-3 gap-4">
          {data.map((item) => (
            <li key={item.title} className="flex items-center gap-4">
              <div className={css.iconBox}>
                <Image src={item.icon} alt="" />
              </div>
              <p className={css.projectText}>{item.title}</p>
            </li>
          ))}
        </ul>

        <SectionText className="mt-28">Projects we are proud of</SectionText>
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
