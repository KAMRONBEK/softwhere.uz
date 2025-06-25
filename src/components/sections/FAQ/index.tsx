import Accordion from '@/components/Accordion';
import SectionText from '@/components/SectionTitle';
import { useTranslations } from 'use-intl';
import css from './style.module.css';

function FAQ() {
  const t = useTranslations('faq');
  const faq = [
    {
      id: 0,
      title: t('question1'),
      answer: t('answer1'),
    },
    {
      id: 1,
      title: t('question2'),
      answer: t('answer2'),
    },
    {
      id: 2,
      title: t('question3'),
      answer: t('answer3'),
    },
    {
      id: 3,
      title: t('question4'),
      answer: t('answer4'),
    },
  ];

  return (
    <section className={css.section} id='faq'>
      <div className='container'>
        <SectionText>{t('title')}</SectionText>
        <SectionText className='lg:w-1/2' type={'desc'}>
          {t('description')}
        </SectionText>
        <div className=''>
          {faq.map((item, index) => (
            <Accordion index={index} key={item.title} title={item.title} answer={item.answer} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default FAQ;
