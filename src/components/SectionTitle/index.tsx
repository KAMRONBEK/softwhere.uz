import React, { ReactNode } from 'react';
import css from './style.module.css';

interface Props {
  children: string | ReactNode;
  type?: string;
  className?: string;
}

function SectionText({ children, type, className }: Props) {
  if (type === 'desc') {
    return (
      <p data-aos='fade-right' className={`${css.description} ${className}`}>
        {children}
      </p>
    );
  }

  return (
    <h2 data-aos='fade-down' className={`${css.sectionTitle} ${className}`}>
      {children}
    </h2>
  );
}

export default SectionText;
