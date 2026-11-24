'use client';

import type { ComponentType } from 'react';
import css from './ui.module.css';
import {
  SiAmazonwebservices,
  SiAndroid,
  SiAngular,
  SiAnthropic,
  SiApple,
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

type IconComponent = ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean }>;

/** Brand icons referenced by name from the catalog (react-icons/si subset). */
const ICONS: Record<string, IconComponent> = {
  SiAmazonwebservices,
  SiAndroid,
  SiAngular,
  SiAnthropic,
  SiApple,
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
  /** Used for the letter-chip fallback. */
  label: string;
  size?: number;
};

/**
 * Brand icon for tech/integration chips: Simple Icons when available, else a
 * letter (regional services like Payme and 1C have no SI glyph).
 */
export default function TechIcon({ icon, label, size = 18 }: Props) {
  const Icon = icon ? ICONS[icon] : undefined;
  if (Icon) return <Icon className={css.brand} size={size} aria-hidden />;
  return (
    <span className={css.letter} aria-hidden>
      {label.charAt(0).toUpperCase()}
    </span>
  );
}
