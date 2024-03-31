"use client";
import {useRef, useState} from "react";
import Slider from "react-slick";

import Image from "next/image";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import css from "./style.module.css";

import AppStoreIcon from "../../../../../../public/icons/ios.svg";
import LinkToIcon from "../../../../../../public/icons/link.svg";
import LocationIcon from "../../../../../../public/icons/place_outline_24.svg";
import PlayMarketIcon from "../../../../../../public/icons/play-market.svg";
import WorkIcon from "../../../../../../public/icons/work_outline_24.svg";
import ProjectImage from "../../../../../../public/images/i-teka.png";

function ProjectSlider() {
    const sliderRef = useRef<Slider | null>(null);
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
            playMarket: "aaa",
            appStore: "",
            website: "aa",
        },
        {
            id: 2,
            name: "Dauletten",
            description:
                "The application is designed to search for drugs by availability in pharmacies in cities. During quarantine, the application helped many people, which gives more value.",
            technology: "Business analysis / iOS / Android / QA / UI/UX Design",
            location: "Uzbekistan",
            type: "Medicine",
            website: "aa",
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
            website: "aa"
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
            name: "Home Bank",
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
        dots: false,
        infinite: true,
        slidesToShow: 1,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 2500,
        arrows: false,
        beforeChange: (current: number, next: number) => {
            setActiveSlide(next + 1);
        },
        responsive: [
            {
                breakpoint: 450,
                settings: {
                    dots: true
                }
            },
        ]
    };

    const handleChangeSlide = (i: number) => {
        setActiveSlide(i + 1);
        if (sliderRef.current) {
            sliderRef.current.slickGoTo(Number(i));
        }
    };

    return (
        <div className="mt-10">
            <ul className="hidden lg:flex">
                {project.map((item) => (
                    <li
                        className={`lg:p-4 md:p-2  cursor-pointer ${css.slide}  ${
                            activeSlide === item.id ? css.active : ""
                        }`}
                        key={item.id}
                        onClick={() => handleChangeSlide(item.id - 1)}
                    >
                        <p>{item.name}</p>
                    </li>
                ))}
            </ul>

            <Slider ref={sliderRef} {...settings}>
                {project.map((item) => (
                    <div
                        key={item.name}
                        className={`!grid lg:mt-10 md:mt-6 md:grid-cols-2 grid-cols-1 items-center ${css.project}`}
                    >
                        <div className={css.itemContent}>
                            <b className={css.name}>{item.name}</b>
                            <p className={css.desc}>{item.description}</p>
                            <p className={css.desc}>{item.technology}</p>
                            <div className="flex gap-8 md:my-10 my-5 justify-center md:justify-start">
                                <div className="flex items-center gap-2">
                                    <Image src={LocationIcon} alt=""/>
                                    <p className="md:text-sm lg:text-base">{item.location}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Image src={WorkIcon} alt=""/>
                                    <p className="md:text-sm lg:text-base">{item.type}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-center md:justify-start gap-4">
                                {item.appStore && (
                                    <a href={item.appStore}>
                                        <Image src={AppStoreIcon} alt=""/>
                                    </a>
                                )}
                                {item.playMarket && (
                                    <a href={item.playMarket}>
                                        <Image src={PlayMarketIcon} alt=""/>
                                    </a>
                                )}
                                {item.website && (
                                    <a href={item.website}>
                                        <Image src={LinkToIcon} alt=""/>
                                    </a>
                                )}
                            </div>
                        </div>
                        <Image className={css.itemImage} src={ProjectImage} alt=""/>
                    </div>
                ))}
            </Slider>
        </div>
    );
}

export default ProjectSlider;
