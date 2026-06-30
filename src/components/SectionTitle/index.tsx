import React, { ReactNode } from 'react';
import css from './style.module.css';

interface Props {
  children: string | ReactNode;
  type?: string;
  className?: string;
  as?: 'h1' | 'h2';
}

function SectionText({ children, type, className, as = 'h2' }: Props) {
  if (type === 'desc') {
    return (
      <p data-aos='fade-right' className={`${css.description} ${className}`}>
        {children}
      </p>
    );
  }

  const Heading = as;

  return (
    <Heading data-aos='fade-down' className={`${css.sectionTitle} ${className}`}>
      {children}
    </Heading>
  );
}

export default SectionText;
