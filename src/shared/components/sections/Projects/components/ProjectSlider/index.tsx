'use client';
import { useRef, useState } from 'react';
import Slider from 'react-slick';

import Image from 'next/image';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';
import css from './style.module.css';

import { projects } from '@/shared/data/projects';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import AppStoreIcon from '../../../../../../../public/icons/ios.svg';
import LinkToIcon from '../../../../../../../public/icons/link.svg';
import LocationIcon from '../../../../../../../public/icons/place_outline_24.svg';
import PlayMarketIcon from '../../../../../../../public/icons/play-market.svg';
import WorkIcon from '../../../../../../../public/icons/work_outline_24.svg';
import ProjectImage from '../../../../../../../public/images/i-teka.png';

function ProjectSlider() {
  const sliderRef = useRef<Slider | null>(null);
  const params = useParams();
  const t = useTranslations('projects');
  const [activeSlide, setActiveSlide] = useState<number>(1);
  const lang = (params?.locale as string) || 'uz';

  const settings = {
    dots: false,
    infinite: true,
    // Without lazyLoad, infinite mode CLONES every slide into the DOM
    // (11 projects rendered as 23 nodes = ~60KB of homepage HTML with
    // 100+ duplicate <img> tags). ondemand renders slides as they show.
    lazyLoad: 'ondemand' as const,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2500,
    arrows: false,
    pauseOnHover: true,
    pauseOnFocus: true,
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
    <div className='mt-10'>
      <div className='hidden lg:flex'>
        {projects.map((item, _index) => (
          <button
            type='button'
            className={`lg:p-4 md:p-2  cursor-pointer ${css.slide}  ${activeSlide === item.id ? css.active : ''}`}
            key={item.id}
            aria-label={t('viewProject', { name: item.name })}
            aria-current={activeSlide === item.id}
            onClick={() => handleChangeSlide(item.id - 1)}
          >
            <p>{item.name}</p>
          </button>
        ))}
      </div>

      <Slider ref={sliderRef} {...settings}>
        {projects.map(item => (
          <div key={item.name} className={`!grid lg:mt-10 md:mt-6 md:grid-cols-2 grid-cols-1 items-center ${css.project}`}>
            <div className={css.itemContent}>
              <b data-aos='zoom-in' className={css.name}>
                {item.name}
              </b>
              <p data-aos='zoom-in' data-aos-delay='100' className={css.desc}>
                {/* No English copy exists yet — fall back to Russian rather
                    than rendering an empty paragraph on the en locale. */}
                {lang === 'uz' ? item.description.uz : item.description.ru}
              </p>
              <p data-aos='zoom-in' data-aos-delay='200' className={css.desc}>
                {item.technology}
              </p>
              <div className='flex gap-8 md:my-10 my-5 justify-center md:justify-start'>
                <div className='flex items-center gap-2' data-aos='zoom-in' data-aos-delay='300'>
                  <Image src={LocationIcon} alt='' />
                  <p className='md:text-sm lg:text-base'>{item.location}</p>
                </div>
                <div className='flex items-center gap-2' data-aos='zoom-in' data-aos-delay='400'>
                  <Image src={WorkIcon} alt='' />
                  <p className='md:text-sm lg:text-base'>{item.type}</p>
                </div>
              </div>
              <div className='flex items-center justify-center md:justify-start gap-4'>
                {item.appStore && (
                  <a
                    target='_blank'
                    rel='noopener noreferrer'
                    data-aos='flip-up'
                    href={item.appStore}
                    aria-label={`${item.name} on the App Store`}
                  >
                    <Image src={AppStoreIcon} alt='' />
                  </a>
                )}
                {item.playMarket && (
                  <a
                    data-aos='flip-up'
                    data-aos-delay='100'
                    href={item.playMarket}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-label={`${item.name} on Google Play`}
                  >
                    <Image src={PlayMarketIcon} alt='' />
                  </a>
                )}
                {item.website && (
                  <a
                    data-aos='flip-up'
                    data-aos-delay='200'
                    target='_blank'
                    rel='noopener noreferrer'
                    href={item.website}
                    aria-label={`${item.name} website`}
                  >
                    <Image src={LinkToIcon} alt='' />
                  </a>
                )}
              </div>
            </div>
            <Image data-aos='fade-up-left' className={css.itemImage} src={ProjectImage} alt='' />
          </div>
        ))}
      </Slider>
    </div>
  );
}

export default ProjectSlider;
