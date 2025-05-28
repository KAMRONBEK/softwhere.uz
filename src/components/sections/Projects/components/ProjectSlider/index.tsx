'use client';
import { useEffect, useRef, useState } from 'react';
import Slider from 'react-slick';

import Image from 'next/image';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';
import css from './style.module.css';

import AppStoreIcon from '../../../../../../public/icons/ios.svg';
import LinkToIcon from '../../../../../../public/icons/link.svg';
import LocationIcon from '../../../../../../public/icons/place_outline_24.svg';
import PlayMarketIcon from '../../../../../../public/icons/play-market.svg';
import WorkIcon from '../../../../../../public/icons/work_outline_24.svg';
import ProjectImage from '../../../../../../public/images/i-teka.png';
import { projects } from '@/data/projects';
import { getCookie } from 'cookies-next';

function ProjectSlider() {
  const sliderRef = useRef<Slider | null>(null);
  const [activeSlide, setActiveSlide] = useState<number>(1);
  const [lang, setLang] = useState<string>('uz');

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

  useEffect(() => {
    const currentLang = getCookie('NEXT_LOCALE') || 'uz';

    setLang(currentLang);
  }, []);

  const handleChangeSlide = (i: number) => {
    setActiveSlide(i + 1);
    if (sliderRef.current) {
      sliderRef.current.slickGoTo(Number(i));
    }
  };

  return (
    <div className='mt-10'>
      <ul className='hidden lg:flex'>
        {projects.map((item, index) => (
          <li
            className={`lg:p-4 md:p-2  cursor-pointer ${css.slide}  ${
              activeSlide === item.id ? css.active : ''
            }`}
            key={item.id}
            onClick={() => handleChangeSlide(item.id - 1)}
          >
            <p>{item.name}</p>
          </li>
        ))}
      </ul>

      <Slider ref={sliderRef} {...settings}>
        {projects.map(item => (
          <div
            key={item.name}
            className={`!grid lg:mt-10 md:mt-6 md:grid-cols-2 grid-cols-1 items-center ${css.project}`}
          >
            <div className={css.itemContent}>
              <b data-aos='zoom-in' className={css.name}>
                {item.name}
              </b>
              <p data-aos='zoom-in' data-aos-delay='100' className={css.desc}>
                {lang === 'uz'
                  ? item.description.uz
                  : lang === 'ru'
                    ? item.description.ru
                    : ''}
              </p>
              <p data-aos='zoom-in' data-aos-delay='200' className={css.desc}>
                {item.technology}
              </p>
              <div className='flex gap-8 md:my-10 my-5 justify-center md:justify-start'>
                <div
                  className='flex items-center gap-2'
                  data-aos='zoom-in'
                  data-aos-delay='300'
                >
                  <Image src={LocationIcon} alt='' />
                  <p className='md:text-sm lg:text-base'>{item.location}</p>
                </div>
                <div
                  className='flex items-center gap-2'
                  data-aos='zoom-in'
                  data-aos-delay='400'
                >
                  <Image src={WorkIcon} alt='' />
                  <p className='md:text-sm lg:text-base'>{item.type}</p>
                </div>
              </div>
              <div className='flex items-center justify-center md:justify-start gap-4'>
                {item.appStore && (
                  <a target='_blank' data-aos='flip-up' href={item.appStore}>
                    <Image src={AppStoreIcon} alt='' />
                  </a>
                )}
                {item.playMarket && (
                  <a
                    data-aos='flip-up'
                    data-aos-delay='100'
                    href={item.playMarket}
                    target='_blank'
                  >
                    <Image src={PlayMarketIcon} alt='' />
                  </a>
                )}
                {item.website && (
                  <a
                    data-aos='flip-up'
                    data-aos-delay='200'
                    target='_blank'
                    href={item.website}
                  >
                    <Image src={LinkToIcon} alt='' />
                  </a>
                )}
              </div>
            </div>
            <Image
              data-aos='fade-up-left'
              className={css.itemImage}
              src={ProjectImage}
              alt=''
            />
          </div>
        ))}
      </Slider>
    </div>
  );
}

export default ProjectSlider;
