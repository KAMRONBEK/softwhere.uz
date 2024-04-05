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
      name: "Primus mall",
      description:
        "Primus Mall shunchaki imkoniyatlari cheklangan onlayn-do'kon emas, siz o'zingizga kerakli tovarlarni uyingizdan chiqmasdan, onlayn xarid qilishingiz mumkin.",
      technology: "React Native / Redux / Google Maps API / iOS / Android",
      location: "Uzbekistan",
      type: "Marketplace",
      playMarket: "https://play.google.com/store/apps/details?id=uz.pmall.app",
      appStore: "https://apps.apple.com/uz/app/primus-mall-marketplace/id1546081249",
      website: "",
    },
    {
      id: 2,
      name: "EDOCS",
      description:
        "“E-DOCS” (edocs.uz) yuridik ahamiyatga ega boʻlgan elektron hujjat aylanishini taʼminlash boʻyicha dasturiy taʼminot toʻplami elektron shaklda hisob-fakturalarni (yetkazib berish dalolatnomalari, dalolatnomalar va boshqalar) yaratish hamda ularni mijozlar va hamkorlar bilan almashish imkonini beruvchi tizimdir.",
      technology: "React Native / Redux Saga / Google Maps API / iOS / Android",
      location: "Uzbekistan",
      type: "Elektron Dokumentlar",
      playMarket: "https://play.google.com/store/apps/details?id=uz.edocs.app",
      appStore: "https://apps.apple.com/uz/app/edocs/id1525550801",
    },
    {
      id: 3,
      name: "BDM",
      description:
        "Biznes dasturlash markazi bo'lib, har bir hujjat BDM tizimi orqali imzolanib, qonuniy kuchga ega bo'ladi.",
      technology: "React Native / Redux Saga / Formik / Google Maps API / iOS / Android",
      location: "Uzbekistan",
      type: "BIZNES DASTURLASH MARKAZI",
      playMarket: "https://play.google.com/store/apps/details?id=uz.bdm.bdm_uz",
      appStore: "https://apps.apple.com/id/app/bdm-uz/id1641747341",
      website: "",
    },
    {
      id: 4,
      name: "ASCON",
      description:
        "ASCON loyihasi doirasida bizning xizmatimizdan foydalanib, sizga tezkor to'lov to'lanadi va zararni olish uchun boshqa holatlar bo'ylab yugurishingiz shart emas.",
      technology: "React Native / Redux Saga / Google Maps API / iOS / Android",
      location: "Uzbekistan",
      type: "ASCON",
      playMarket: "https://play.google.com/store/apps/details?id=uz.sos.ascon&hl=ru",
      appStore: "https://apps.apple.com/ru/developer/ascon/id570657052",
    },
    {
      id: 5,
      name: "HeyAll",
      description:
        "HeyAll, ikki xil maqsadga xizmat qiluvchi va ularni uzluksiz bog‘laydigan ilova. Bir tomondan, bu xostlar uchun o'z tadbirlarini rejalashtirish uchun ilova bo'lsa, boshqa tomondan, bu tadbirlarda ishlaydigan yetkazib beruvchilar uchun dastur.",
      technology: "React / React Native / Redux Thunks / Google Maps API / iOS / Android",
      location: "Europe",
      type: "HeyAll",
      playMarket: "https://play.google.com/store/apps/details?id=com.app.heyall",
      appStore: "https://apps.apple.com/au/app/heyall/id1590498767",
      website: "https://www.heyallapp.com/"
    },
    {
      id: 6,
      name: "Align 360",
      description:
        "Align 360 qurilish va ta'mirlash guruhlari uchun mo'ljallangan. Ilova vazifalar menejeri, tahliliy vosita va jamoalar ichida muloqot qilish uchun messenjerni birlashtiradi. Ilovadan ishni tashkil etuvchi pudratchilar ham, turli ixtisoslikdagi subpudratchilar ham foydalanishlari mumkin.",
      technology: "React Native / Typescript / Redux Thunks / Google Maps API / iOS / Android",
      location: "All",
      type: "Align 360",
      playMarket: "https://play.google.com/store/apps/details?id=com.align360",
      appStore: "https://apps.apple.com/us/app/align-360/id1608045052",
    },
    {
      id: 7,
      name: "NAFT",
      description:
        "Agar sizga zudlik bilan ish kerak bo'lsa yoki aksincha, mutaxassis, u holda Naft aynan sizga kerak bo'lgan narsadir. Bizning ilovamiz tez va qulay nomzodlar va nomzodlarning cho'ntak manbai bo'lib, u erda har bir foydalanuvchi o'ziga kerakli narsani topa oladi.",
      technology: "React Native / Redux Saga / Google Maps API / iOS / Android",
      location: "All",
      type: "NAFT",
      playMarket: "https://play.google.com/store/apps/details?id=itmaker.uz.naft",
      appStore: "https://apps.apple.com/us/app/naft/id1519755756",
    },
    {
      id: 8,
      name: "WorkAxle",
      description:
          "WorkAxle - bu kengaytiriladigan, kelajakka chidamli va tez miqyosda joylashtiriladigan zamonaviy va modulli korporativ ishchi kuchini boshqarish platformasi. Ushbu platforma an'anaviy monolit WFM ilovalari muammosini hal qiladi, shu bilan birga korporativ mijozlar uchun moslashtirilgan yechimni taqdim etadi.",
      technology: "React / Flexbox / Redux / Git ",
      location: "Canada",
      type: "WorkAxle",
      website: "https://www.workaxle.com/"
    },
    {
      id: 9,
      name: "Asia Insurance",
      description:
          "Asia Insurance mobil ilovasi bir necha daqiqada transport vositalari egalari uchun OSGO polisini, xorijga onlayn sayohat qilish uchun sug‘urta polisini sotib olishga yordam beradi va bu hali boshlanishi!",
      technology: "React / Redux-thunks / Google Maps API / Flexbox / Redux / Yandex Maps ",
      location: "Uzbekistan",
      type: "Asia Insurance",
      website: "https://asiainsurance.uz/"
    },
    {
      id: 10,
      name: "Nestegg.ai",
      description:
          "NestEgg sizga Buyuk Britaniyaning mas'ul kreditorlaridan ishonchli kreditlarni topishga, ariza topshirishga va ularni qabul qilishga yordam beradi. Platforma mas'ul kreditorlarga kredit arizalarini yuboradi va ular o'zlari va mijozlari uchun yaxshiroq kredit qarorlarini qabul qilishlari uchun kredit qarorlarini qabul qilish xizmatlarini taqdim etadi. U buni kredit, bank va boshqa ma'lumotlarni adolatli, moslashuvchan va shaffof tarzda tahlil qilish orqali amalga oshiradi.",
      technology: "React / Redux-thunks / Google Maps API / Flexbox / Redux / Yandex Maps ",
      location: "Europe",
      type: "Nestegg.ai",
      website: "https://nestegg.ai/"
    },
    {
      id: 11,
      name: "Nestegg Loan",
      description:
          "NestEgg platformasi mas'ul kreditorlar tomonidan taqdim etilgan kredit mahsulotlari bilan qulay kredit izlayotganlarga mos keladi. Ariza beruvchilar to'g'ri kreditordan to'g'ri kreditni topadilar, ular qabul qilinadimi yoki yo'qmi va ariza berishadi. Agar yo'q bo'lsa, qanday qilib qabul qilinishi haqida maslahatlar oling.",
      technology: "React / Redux-thunks / Google Maps API / Flexbox / Redux / Yandex Maps ",
      location: "Europe",
      type: "Nestegg.ai",
      website: "https://loans.nestegg.ai/"
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
        {project.map((item, index) => (
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
              <b data-aos="zoom-in" className={css.name}>
                {item.name}
              </b>
              <p data-aos="zoom-in" data-aos-delay="100" className={css.desc}>
                {item.description}
              </p>
              <p data-aos="zoom-in" data-aos-delay="200" className={css.desc}>
                {item.technology}
              </p>
              <div className="flex gap-8 md:my-10 my-5 justify-center md:justify-start">
                <div
                  className="flex items-center gap-2"
                  data-aos="zoom-in"
                  data-aos-delay="300"
                >
                  <Image src={LocationIcon} alt="" />
                  <p className="md:text-sm lg:text-base">{item.location}</p>
                </div>
                <div
                  className="flex items-center gap-2"
                  data-aos="zoom-in"
                  data-aos-delay="400"
                >
                  <Image src={WorkIcon} alt="" />
                  <p className="md:text-sm lg:text-base">{item.type}</p>
                </div>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-4">
                {item.appStore && (
                  <a target="_blank" data-aos="flip-up" href={item.appStore}>
                    <Image src={AppStoreIcon} alt="" />
                  </a>
                )}
                {item.playMarket && (
                  <a
                    data-aos="flip-up"
                    data-aos-delay="100"
                    href={item.playMarket}
                    target="_blank"
                  >
                    <Image src={PlayMarketIcon} alt="" />
                  </a>
                )}
                {item.website && (
                  <a
                    data-aos="flip-up"
                    data-aos-delay="200"
                    target="_blank"
                    href={item.website}
                  >
                    <Image src={LinkToIcon} alt="" />
                  </a>
                )}
              </div>
            </div>
            <Image
              data-aos="fade-up-left"
              className={css.itemImage}
              src={ProjectImage}
              alt=""
            />
          </div>
        ))}
      </Slider>
    </div>
  );
}

export default ProjectSlider;
