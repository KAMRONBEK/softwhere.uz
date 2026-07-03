'use client';

import type { ComponentType } from 'react';
import {
  SiAmazonwebservices,
  SiAngular,
  SiAnthropic,
  SiAstro,
  SiClaude,
  SiClickhouse,
  SiDirectus,
  SiDjango,
  SiDocker,
  SiDotnet,
  SiElasticsearch,
  SiElectron,
  SiExpo,
  SiFastapi,
  SiFirebase,
  SiFlutter,
  SiGo,
  SiGooglecloud,
  SiGooglegemini,
  SiGooglemaps,
  SiGooglesheets,
  SiHetzner,
  SiKotlin,
  SiKubernetes,
  SiLangchain,
  SiLaravel,
  SiMongodb,
  SiMysql,
  SiNestjs,
  SiNextdotjs,
  SiNodedotjs,
  SiNuxtdotjs,
  SiOllama,
  SiOpenai,
  SiPaypal,
  SiPhp,
  SiPostgresql,
  SiPython,
  SiQt,
  SiReact,
  SiRedis,
  SiRubyonrails,
  SiSpring,
  SiStrapi,
  SiStripe,
  SiSupabase,
  SiSvelte,
  SiSwift,
  SiTailwindcss,
  SiTauri,
  SiTelegram,
  SiVercel,
  SiVuedotjs,
  SiWordpress,
} from 'react-icons/si';

type IconComponent = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

/** Brand icons referenced by name from the catalog (react-icons/si subset). */
const ICONS: Record<string, IconComponent> = {
  SiAmazonwebservices,
  SiAngular,
  SiAnthropic,
  SiAstro,
  SiClaude,
  SiClickhouse,
  SiDirectus,
  SiDjango,
  SiDocker,
  SiDotnet,
  SiElasticsearch,
  SiElectron,
  SiExpo,
  SiFastapi,
  SiFirebase,
  SiFlutter,
  SiGo,
  SiGooglecloud,
  SiGooglegemini,
  SiGooglemaps,
  SiGooglesheets,
  SiHetzner,
  SiKotlin,
  SiKubernetes,
  SiLangchain,
  SiLaravel,
  SiMongodb,
  SiMysql,
  SiNestjs,
  SiNextdotjs,
  SiNodedotjs,
  SiNuxtdotjs,
  SiOllama,
  SiOpenai,
  SiPaypal,
  SiPhp,
  SiPostgresql,
  SiPython,
  SiQt,
  SiReact,
  SiRedis,
  SiRubyonrails,
  SiSpring,
  SiStrapi,
  SiStripe,
  SiSupabase,
  SiSvelte,
  SiSwift,
  SiTailwindcss,
  SiTauri,
  SiTelegram,
  SiVercel,
  SiVuedotjs,
  SiWordpress,
};

type Props = {
  /** react-icons/si component name from the catalog. */
  icon?: string;
  /** Emoji fallback (regional services without brand icons). */
  flag?: string;
  /** Used for the letter-chip fallback. */
  label: string;
  className?: string;
};

/**
 * Brand icon for tech/integration chips: Simple Icons when available, emoji
 * for regional services (Payme/Click/1C have no SI glyph), letter chip last.
 */
export default function TechIcon({ icon, flag, label, className = 'w-4 h-4' }: Props) {
  const Icon = icon ? ICONS[icon] : undefined;
  if (Icon) return <Icon className={className} aria-hidden />;
  if (flag) {
    return (
      <span className='text-sm leading-none' aria-hidden>
        {flag}
      </span>
    );
  }
  return (
    <span
      className='w-4 h-4 rounded-[5px] bg-ember-surface2 text-ember-muted text-[10px] font-bold flex items-center justify-center leading-none'
      aria-hidden
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}
