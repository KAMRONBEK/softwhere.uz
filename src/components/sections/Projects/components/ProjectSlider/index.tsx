"use client";
import React, {useState} from "react";
import Slider from "react-slick";

import Image from "next/image";
import css from "./style.module.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import LocationIcon from "../../../../../../public/icons/place_outline_24.svg";
import WorkIcon from "../../../../../../public/icons/work_outline_24.svg";
import AppStoreIcon from "../../../../../../public/icons/ios.svg";
import PlayMarketIcon from "../../../../../../public/icons/play-market.svg";
import ProjectImage from "../../../../../../public/images/i-teka.png";

function ProjectSlider() {
  const [activeSlide, setActiveSlide] = useState<number>(1);
  const project = [
    {
      id: 1,
      name: "I-teka",
      description:
        "The application is designed to search for drugs by availability in pharmacies in cities. During quarantine, the application helped many people, which gives more value.",
      technology: "Business analysis / iOS / Android / QA / UI/UX Design",
      location: "Uzbekistan",
      type: "Medicine",
      playMarket: "aa",
      appStore: "aa",
    },
    {
      id: 2,
      name: "Dauletten",
      description:
        "The application is designed to search for drugs by availability in pharmacies in cities. During quarantine, the application helped many people, which gives more value.",
      technology: "Business analysis / iOS / Android / QA / UI/UX Design",
      location: "Uzbekistan",
      type: "Medicine",
      playMarket: "aa",
      appStore: "aa",
    },
    {
      id: 3,
      name: "Guru Bosch",
      description:
        "The application is designed to search for drugs by availability in pharmacies in cities. During quarantine, the application helped many people, which gives more value.",
      technology: "Business analysis / iOS / Android / QA / UI/UX Design",
      location: "Uzbekistan",
      type: "Medicine",
      playMarket: "aa",
      appStore: "aa",
    },
    {
      id: 4,
      name: "Santo",
      description:
        "The application is designed to search for drugs by availability in pharmacies in cities. During quarantine, the application helped many people, which gives more value.",
      technology: "Business analysis / iOS / Android / QA / UI/UX Design",
      location: "Uzbekistan",
      type: "Medicine",
      playMarket: "aa",
      appStore: "aa",
    },
    {
      id: 5,
      name: "Home Credit Bank",
      description:
        "The application is designed to search for drugs by availability in pharmacies in cities. During quarantine, the application helped many people, which gives more value.",
      technology: "Business analysis / iOS / Android / QA / UI/UX Design",
      location: "Uzbekistan",
      type: "Medicine",
      playMarket: "aa",
      appStore: "aa",
    },
    {
      id: 6,
      name: "BI Partners",
      description:
        "The application is designed to search for drugs by availability in pharmacies in cities. During quarantine, the application helped many people, which gives more value.",
      technology: "Business analysis / iOS / Android / QA / UI/UX Design",
      location: "Uzbekistan",
      type: "Medicine",
      playMarket: "aa",
      appStore: "aa",
    },
    {
      id: 7,
      name: "Europharma",
      description:
        "The application is designed to search for drugs by availability in pharmacies in cities. During quarantine, the application helped many people, which gives more value.",
      technology: "Business analysis / iOS / Android / QA / UI/UX Design",
      location: "Uzbekistan",
      type: "Medicine",
      playMarket: "aa",
      appStore: "aa",
    },
  ];

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  };
  return (
    <div className="mt-10">
      <ul className="flex">
        {project.map((item) => (
          <li
            className={`p-4 cursor-pointer ${css.slide}  ${
              activeSlide === item.id ? css.active : ""
            }`}
            key={item.id}
            onClick={() => setActiveSlide(item.id)}
          >
            <p>{item.name}</p>
          </li>
        ))}
      </ul>

      <Slider {...settings}>
        {project.map((item) => (
          <li
            key={item.name}
            className={`grid mt-10 grid-cols-2 gap-4 items-center ${css.project}`}
          >
            <div>
              <b className={css.name}>{item.name}</b>
              <p className={css.desc}>{item.description}</p>
              <p className={css.desc}>{item.technology}</p>
              <div className="flex gap-8 my-10">
                <div className="flex items-center gap-2">
                  <Image src={LocationIcon} alt="" />
                  <p>{item.location}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Image src={WorkIcon} alt="" />
                  <p>{item.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <a href={item.appStore}>
                  <Image src={AppStoreIcon} alt="" />
                </a>
                <a href={item.playMarket}>
                  <Image src={PlayMarketIcon} alt="" />
                </a>
              </div>
            </div>
            <Image src={ProjectImage} alt="" />
          </li>
        ))}
      </Slider>
    </div>
  );
}

export default ProjectSlider;
