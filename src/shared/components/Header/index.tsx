'use client';

import { UI_CONFIG } from '@/core/constants';
import { useBlogContext } from '@/modules/blog/context/BlogContext';
import { getRelatedPost } from '@/modules/blog/api/posts';
import { logger } from '@/core/logger';
import { trackEvent } from '@/shared/utils/analytics';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import RuFlag from '../../../../public/icons/Russia (RU).svg';
import EngFlag from '../../../../public/icons/United Kingdom (GB).svg';
import UzbFlag from '../../../../public/icons/Uzbekistan (UZ).svg';
import Logo from '../../../../public/icons/logo.svg';
import ThemeToggle from '../ThemeToggle';
import css from './style.module.css';

type LanguageSwitcherProps = {
  lang: string;
  label: string;
  menuId: string;
  onChange: (locale: string) => void;
};

function LanguageSwitcher({ lang, label, menuId, onChange }: LanguageSwitcherProps) {
  const [open, setOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleSelect = (locale: string) => {
    setOpen(false);
    onChange(locale);
  };

  const options: { id: string; flag: typeof EngFlag; label: string }[] = [
    { id: 'en', flag: EngFlag, label: 'En' },
    { id: 'ru', flag: RuFlag, label: 'Ru' },
    { id: 'uz', flag: UzbFlag, label: 'Uz' },
  ];

  return (
    <div className={css.dropdown} ref={ref}>
      <button
        type='button'
        className={`flex items-center cursor-pointer ${css.lang}`}
        aria-haspopup='true'
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen(prev => !prev)}
      >
        <span>{lang.toUpperCase()}</span>
        <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
          <path
            fillRule='evenodd'
            clipRule='evenodd'
            d='M17.7364 9.2635C17.3849 8.91203 16.8151 8.91203 16.4636 9.26351L12 13.7271L7.53639 9.2635C7.18492 8.91203 6.61507 8.91203 6.2636 9.26351C5.91213 9.61498 5.91213 10.1848 6.26361 10.5363L11.3636 15.6363C11.7151 15.9878 12.285 15.9878 12.6364 15.6363L17.7364 10.5363C18.0879 10.1848 18.0879 9.61498 17.7364 9.2635Z'
            fill='currentColor'
          />
        </svg>
      </button>
      <ul id={menuId} className={`${css.content} ${open ? css.contentOpen : ''}`}>
        {options.map(option => (
          <li key={option.id}>
            <button
              type='button'
              className={`${css.langOption} ${lang === option.id ? css.activeLang : ''}`}
              aria-current={lang === option.id}
              onClick={() => handleSelect(option.id)}
            >
              <Image src={option.flag} alt={''} />
              <p>{option.label}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Header() {
  const t = useTranslations('header');
  const params = useParams();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [lang, setLang] = useState<string>((params?.locale as string) || 'uz');
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const router = useRouter();
  const { currentPost } = useBlogContext();

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
    trackEvent('language_switch', { from: lang, to: locale });

    if (currentPost?.generationGroupId) {
      try {
        logger.info(
          `Switching language to ${locale} for post with generationGroupId: ${currentPost.generationGroupId}`,
          undefined,
          'HEADER_LANGUAGE_SWITCH'
        );

        // Try to find the related post in the target language using API client
        const response = await getRelatedPost(currentPost.generationGroupId, locale);

        if (response.success && response.data) {
          // Navigate to the related post in the target language
          router.push(`/${locale}/blog/${response.data.post.slug}`);
          setLang(locale);
          logger.info(`Successfully switched to related post: ${response.data.post.slug}`, undefined, 'HEADER_LANGUAGE_SWITCH');

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
        logger.error('Error switching language', error, 'HEADER_LANGUAGE_SWITCH');
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
    <header className={`${css.header} ${!isHeaderVisible ? css.headerHidden : ''}`}>
      <div className={css.inner}>
        <Link href='/' className={css.brand}>
          <Image src={Logo} alt='' className={css.logo} />
          <span className={css.wordmark}>softwhere</span>
        </Link>

        <ul className={css.links}>
          <li>
            <Link href={`/${lang}#services`}>{t('services')}</Link>
          </li>
          <li>
            <Link href={`/${lang}#portfolio`}>{t('work')}</Link>
          </li>
          <li>
            <Link href={`/${lang}#ai`}>{t('ai')}</Link>
          </li>
          <li>
            <Link href={`/${lang}/blog`}>{t('blog')}</Link>
          </li>
          <li>
            <Link href={`/${lang}/estimator`}>{t('estimate')}</Link>
          </li>
        </ul>

        <div className={css.actions}>
          <LanguageSwitcher lang={lang} label={t('lang')} menuId='desktop-lang-menu' onChange={changeLanguage} />
          <ThemeToggle />
          <Link href={`/${lang}#contact`} className={css.ctaPill}>
            {t('letsTalk')}
          </Link>
        </div>

        <button
          type='button'
          className={css.burgerMenu}
          onClick={toggleMenu}
          aria-label={isOpen ? t('closeMenu') : t('openMenu')}
          aria-expanded={isOpen}
          aria-controls='mobile-nav'
        >
          <div className={`${css.burgerLine} ${isOpen ? css.open : ''}`}></div>
          <div className={`${css.burgerLine} ${isOpen ? css.open : ''}`}></div>
          <div className={`${css.burgerLine} ${isOpen ? css.open : ''}`}></div>
        </button>
      </div>

      <nav id='mobile-nav' className={`${css.navMobile} ${isOpen ? css.navOpen : ''}`} inert={!isOpen}>
        <ul className={css.mobileLinks}>
          <li>
            <Link href={`/${lang}#services`} onClick={toggleMenu}>
              {t('services')}
            </Link>
          </li>
          <li>
            <Link href={`/${lang}#portfolio`} onClick={toggleMenu}>
              {t('work')}
            </Link>
          </li>
          <li>
            <Link href={`/${lang}#ai`} onClick={toggleMenu}>
              {t('ai')}
            </Link>
          </li>
          <li>
            <Link href={`/${lang}/blog`} onClick={toggleMenu}>
              {t('blog')}
            </Link>
          </li>
          <li>
            <Link href={`/${lang}/estimator`} onClick={toggleMenu}>
              {t('estimate')}
            </Link>
          </li>
          <li>
            <Link href={`/${lang}#contact`} onClick={toggleMenu} className={css.mobileCta}>
              {t('letsTalk')}
            </Link>
          </li>
          <li>
            <ThemeToggle />
          </li>
          <li>
            <LanguageSwitcher lang={lang} label={t('lang')} menuId='mobile-lang-menu' onChange={changeLanguage} />
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
