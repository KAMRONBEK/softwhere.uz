'use client';

import { CONTACT_INFO, UI_CONFIG } from '@/constants';
import { useBlogContext } from '@/contexts/BlogContext';
import { api } from '@/utils/api';
import { logger } from '@/utils/logger';
import { getCookie } from 'cookies-next';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'use-intl';
import RuFlag from '../../../public/icons/Russia (RU).svg';
import EngFlag from '../../../public/icons/United Kingdom (GB).svg';
import UzbFlag from '../../../public/icons/Uzbekistan (UZ).svg';
import Logo from '../../../public/icons/logo.svg';
import EmailIcon from '../../../public/icons/mail-outline.svg';
import SmartphoneIcon from '../../../public/icons/smartphone-icon.svg';
import css from './style.module.css';

function Header() {
  const t = useTranslations('header');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [lang, setLang] = useState<string>('uz');
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const router = useRouter();
  const { currentPost } = useBlogContext();

  useEffect(() => {
    const currentLang = getCookie('NEXT_LOCALE') || 'uz';

    setLang(currentLang);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Only show header when within threshold of the top
      if (currentScrollY <= UI_CONFIG.SCROLL_THRESHOLD) {
        setIsHeaderVisible(true);
      }
      // Hide header when scrolling down past threshold
      else if (currentScrollY > UI_CONFIG.SCROLL_THRESHOLD) {
        setIsHeaderVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    // Add scroll event listener with throttling for better performance
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });

    // Cleanup
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
    };
  }, [lastScrollY]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    document.body.classList.toggle('hide');
  };

  const changeLanguage = async (locale: string) => {
    // Check if we're on a blog post page and have a current post with generationGroupId
    if (currentPost?.generationGroupId) {
      try {
        logger.info(
          `Switching language to ${locale} for post with generationGroupId: ${currentPost.generationGroupId}`,
          undefined,
          'HEADER_LANGUAGE_SWITCH'
        );

        // Try to find the related post in the target language using API client
        const response = await api.blog.getRelatedPost(
          currentPost.generationGroupId,
          locale
        );

        if (response.success && response.data) {
          // Navigate to the related post in the target language
          router.push(`/${locale}/blog/${response.data.post.slug}`);
          setLang(locale);
          logger.info(
            `Successfully switched to related post: ${response.data.post.slug}`,
            undefined,
            'HEADER_LANGUAGE_SWITCH'
          );

          return;
        } else {
          // If no related post found, redirect to blog listing in target language
          logger.info(
            `No related post found for generationGroupId: ${currentPost.generationGroupId}, redirecting to blog listing`,
            undefined,
            'HEADER_LANGUAGE_SWITCH'
          );
          router.push(`/${locale}/blog`);
          setLang(locale);

          return;
        }
      } catch (error) {
        logger.error(
          'Error switching language',
          error,
          'HEADER_LANGUAGE_SWITCH'
        );
        // Fall back to blog listing in target language
        router.push(`/${locale}/blog`);
        setLang(locale);

        return;
      }
    }

    // Default language switching for non-blog pages
    const pathname = window.location.pathname;
    const pathSegments = pathname.split('/').filter(Boolean);
    let newPath = '/';

    if (pathSegments.length > 0) {
      // Remove the first segment (current locale) and reconstruct the path
      const routeWithoutLocale = pathSegments.slice(1).join('/');

      newPath = `/${locale}/${routeWithoutLocale}`;
    } else {
      // If we're at the root, just add the locale
      newPath = `/${locale}`;
    }

    // Navigate to the new path
    router.push(newPath);
    setLang(locale);
  };

  return (
    <header
      className={`${css.header} container ${!isHeaderVisible ? css.headerHidden : ''}`}
    >
      <a href='/'>
        <Image src={Logo} alt='' />
      </a>
      <ul className={css.links}>
        <li>
          <a href='/'>{t('home')}</a>
        </li>
        <li>
          <a href={`/${lang}#services`}>{t('services')}</a>
        </li>
        <li>
          <a href={`/${lang}#portfolio`}>{t('portfolio')}</a>
        </li>
        <li>
          <a href={`/${lang}/blog`}>{t('blog')}</a>
        </li>
        <li>
          <a href={`/${lang}#contact`}>{t('contact')}</a>
        </li>
        <li>
          <a href={`/${lang}#faq`}>{t('faq')}</a>
        </li>
        <li className={css.dropdown}>
          <div className={`flex items-center cursor-pointer ${css.lang}`}>
            <p>{t('lang')}</p>
            <svg
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M17.7364 9.2635C17.3849 8.91203 16.8151 8.91203 16.4636 9.26351L12 13.7271L7.53639 9.2635C7.18492 8.91203 6.61507 8.91203 6.2636 9.26351C5.91213 9.61498 5.91213 10.1848 6.26361 10.5363L11.3636 15.6363C11.7151 15.9878 12.285 15.9878 12.6364 15.6363L17.7364 10.5363C18.0879 10.1848 18.0879 9.61498 17.7364 9.2635Z'
                fill='#101828'
              />
            </svg>
          </div>
          <div className={css.triangle}></div>
          <ul className={css.content}>
            <li
              className={lang === 'en' ? css.activeLang : ''}
              onClick={() => changeLanguage('en')}
            >
              <Image src={EngFlag} alt={''} />
              <p>En</p>
            </li>
            <li
              className={lang === 'ru' ? css.activeLang : ''}
              onClick={() => changeLanguage('ru')}
            >
              <Image src={RuFlag} alt={''} />
              <p>Ru</p>
            </li>
            <li
              className={lang === 'uz' ? css.activeLang : ''}
              onClick={() => changeLanguage('uz')}
            >
              <Image src={UzbFlag} alt={''} />
              <p>Uz</p>
            </li>
          </ul>
        </li>
      </ul>

      <div className={css.contacts}>
        <div className={css.contact}>
          <Image src={SmartphoneIcon} alt='' />
          <a href={`tel:${CONTACT_INFO.PHONE}`} className='hover:opacity-50'>
            {CONTACT_INFO.PHONE}
          </a>
        </div>
        <div className={css.contact}>
          <Image src={EmailIcon} alt='' />
          <a href={`mailto:${CONTACT_INFO.EMAIL}`} className='hover:opacity-50'>
            {CONTACT_INFO.EMAIL}
          </a>
        </div>
      </div>

      <div className={css.burgerMenu} onClick={toggleMenu}>
        <div className={`${css.burgerLine} ${isOpen ? css.open : ''}`}></div>
        <div className={`${css.burgerLine} ${isOpen ? css.open : ''}`}></div>
        <div className={`${css.burgerLine} ${isOpen ? css.open : ''}`}></div>
      </div>

      <nav className={`${css.navMobile} ${isOpen ? css.navOpen : ''}`}>
        <ul className={css.mobileLinks}>
          <li onClick={toggleMenu}>
            <a href='/'>{t('home')}</a>
          </li>
          <li onClick={toggleMenu}>
            <a href={`/${lang}#services`}>{t('services')}</a>
          </li>
          <li onClick={toggleMenu}>
            <a href={`/${lang}#portfolio`}>{t('portfolio')}</a>
          </li>
          <li onClick={toggleMenu}>
            <a href={`/${lang}/blog`}>{t('blog')}</a>
          </li>
          <li onClick={toggleMenu}>
            <a href={`/${lang}#contact`}>{t('contact')}</a>
          </li>

          <li onClick={toggleMenu}>
            <a href={`/${lang}#faq`}>{t('faq')}</a>
          </li>

          <li className={css.dropdown}>
            <div className={`flex items-center cursor-pointer ${css.lang}`}>
              <p>{t('lang')}</p>
              <svg
                width='24'
                height='24'
                viewBox='0 0 24 24'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  fillRule='evenodd'
                  clipRule='evenodd'
                  d='M17.7364 9.2635C17.3849 8.91203 16.8151 8.91203 16.4636 9.26351L12 13.7271L7.53639 9.2635C7.18492 8.91203 6.61507 8.91203 6.2636 9.26351C5.91213 9.61498 5.91213 10.1848 6.26361 10.5363L11.3636 15.6363C11.7151 15.9878 12.285 15.9878 12.6364 15.6363L17.7364 10.5363C18.0879 10.1848 18.0879 9.61498 17.7364 9.2635Z'
                  fill='#101828'
                />
              </svg>
            </div>
            <div className={css.triangle}></div>
            <ul className={css.content}>
              <li
                className={lang === 'en' ? css.activeLang : ''}
                onClick={() => changeLanguage('en')}
              >
                <Image src={EngFlag} alt={''} />
                <p>En</p>
              </li>
              <li
                className={lang === 'ru' ? css.activeLang : ''}
                onClick={() => changeLanguage('ru')}
              >
                <Image src={RuFlag} alt={''} />
                <p>Ru</p>
              </li>
              <li
                className={lang === 'uz' ? css.activeLang : ''}
                onClick={() => changeLanguage('uz')}
              >
                <Image src={UzbFlag} alt={''} />
                <p>Uz</p>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
