import Link from 'next/link';
import type { ComponentProps } from 'react';
import css from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary';

/** The button's classes, for a <button> or a link component of its own (TrackedCTALink). */
export function buttonClass(variant: ButtonVariant = 'primary', className?: string): string {
  return [css.button, css[variant], className].filter(Boolean).join(' ');
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
}

/** A link that looks like the homepage's calls to action. */
export function ButtonLink({ variant, className, ...rest }: ButtonLinkProps) {
  return <Link {...rest} className={buttonClass(variant, className)} />;
}

/** A link in running text or under a block: the text in --fg, the accent in its underline. */
export function TextLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return <Link {...rest} className={className ? `${css.text} ${className}` : css.text} />;
}
