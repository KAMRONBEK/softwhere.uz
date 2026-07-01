import SectionText from '@/shared/components/SectionTitle';
import ProjectSlider from './components/ProjectSlider';
import css from './style.module.css';
import { useTranslations } from 'next-intl';

function Projects() {
  const t = useTranslations('projects');

  return (
    <section className={css.section} id='portfolio'>
      <div className='container'>
        <div className={css.eyebrow}>{t('eyebrow')}</div>
        <SectionText>{t('title')}</SectionText>
        <SectionText className='mt-6 lg:w-1/2' type='desc'>
          {t('description')}
        </SectionText>
        <ProjectSlider />
      </div>
    </section>
  );
}

export default Projects;
