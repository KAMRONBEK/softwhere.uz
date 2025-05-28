'use client';

import React, { useEffect, useState } from 'react';
import css from './style.module.css';
import ArrowIcon from '../../../public/icons/chevron_right_small_24.svg';
import Image from 'next/image';

function ScrollToTop() {
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 500) {
        setShow(true);
      } else {
        setShow(false);
      }
    });
  }, []);

  const handleClick = () => {
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      onClick={handleClick}
      className={`${css.scrollToTop} ${show ? css.show : ''}`}
    >
      <Image src={ArrowIcon} alt='' />
    </button>
  );
}

export default ScrollToTop;
