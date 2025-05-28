import SectionText from '@/components/SectionTitle';
import ConsultingImage from '../../../../public/images/consulting.png';
import CrmImage from '../../../../public/images/crm.webp';
import LandingPageImage2 from '../../../../public/images/landing-page.webp';
import LandingPageImage from '../../../../public/images/landing.webp';
import MobileImage from '../../../../public/images/mobile.png';
import StartupsImage from '../../../../public/images/startups.webp';
import css from './style.module.css';
import Image from 'next/image';
import { useTranslations } from 'use-intl';

function Service() {
  const t = useTranslations('services');
  const services = [
    {
      id: 0,
      title: t('service1.title'),
      image: LandingPageImage,
      description: t('service1.description'),
    },
    {
      id: 1,
      title: t('service2.title'),
      image: LandingPageImage2,
      description: t('service2.description'),
    },
    {
      id: 2,
      title: t('service3.title'),
      image: MobileImage,
      description: t('service3.description'),
    },
    {
      id: 3,
      title: t('service4.title'),
      image: ConsultingImage,
      description: t('service4.description'),
    },
    {
      id: 4,
      title: t('service5.title'),
      image: StartupsImage,
      description: t('service5.description'),
    },
    {
      id: 5,
      title: t('service6.title'),
      image: CrmImage,
      description: t('service6.description'),
    },
  ];

  return (
    <section className={css.section} id='services'>
      <div className='container'>
        <SectionText>{t('title')}</SectionText>
        <SectionText className='mb-6 lg:w-1/2' type='desc'>
          {t('description')}
        </SectionText>
        <ul className='grid md:grid-cols-2 grid-cols-1 md:gap-6 gap-3'>
          {services.map((item, index) => (
            <li
              data-aos={index % 2 === 0 ? 'flip-down' : 'flip-up'}
              className={css.serviceItem}
              key={item.title}
            >
              <div>
                <b>{item.title}</b>
                <p>{item.description}</p>
              </div>
              <Image src={item.image} alt='' />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Service;
