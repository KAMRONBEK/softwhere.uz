/**
 * Line icons for the CRM demo: 24-box, 1.75 stroke, currentColor. Generic
 * glyphs only (no third-party logos): a paper plane stands for Telegram, a
 * hash for a team-chat channel, a card for payments, and so on.
 */
import type { ReactNode } from 'react';
import type { ModuleId } from './data';
import type { AlertChannel, ConnectorId } from './demo';

interface IconProps {
  className?: string;
}

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
    >
      {children}
    </svg>
  );
}

export function PipelineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x='3.5' y='4' width='4.5' height='15' rx='1.2' />
      <rect x='9.75' y='4' width='4.5' height='10' rx='1.2' />
      <rect x='16' y='4' width='4.5' height='6.5' rx='1.2' />
    </Svg>
  );
}

export function RolesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx='9' cy='8.5' r='3.25' />
      <path d='M3 19.5c.6-3.3 3-5.25 6-5.25s5.4 1.95 6 5.25' />
      <path d='M16.5 4.5 20 6v3.2c0 2.2-1.4 3.6-3.5 4.3-2.1-.7-3.5-2.1-3.5-4.3V6Z' />
    </Svg>
  );
}

export function AutomationsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='M13 3 5.5 13.5H12L11 21l7.5-10.5H12Z' />
    </Svg>
  );
}

export function ReportsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='M4 20h16' />
      <path d='M6.5 16v-4' />
      <path d='M11 16V7' />
      <path d='M15.5 16v-6' />
      <path d='M20 16V4.5' />
    </Svg>
  );
}

export function IntegrationsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='M9 3.5v4' />
      <path d='M15 3.5v4' />
      <path d='M6.5 7.5h11v3.5a5.5 5.5 0 0 1-11 0Z' />
      <path d='M12 16.5v4' />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx='12' cy='12' r='3' />
      <path d='M12 2.75v2.5M12 18.75v2.5M2.75 12h2.5M18.75 12h2.5M5.46 5.46l1.77 1.77M16.77 16.77l1.77 1.77M5.46 18.54l1.77-1.77M16.77 7.23l1.77-1.77' />
    </Svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x='5' y='10.5' width='14' height='10' rx='2' />
      <path d='M8 10.5V8a4 4 0 0 1 8 0v2.5' />
    </Svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z' />
      <path d='M10 20.5a2.2 2.2 0 0 0 4 0' />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx='11' cy='11' r='6.5' />
      <path d='m16 16 4 4' />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='m5 12.5 4.5 4.5L19 7.5' />
    </Svg>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='m6.5 6.5 11 11M17.5 6.5l-11 11' />
    </Svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='M12 4.5v15M6 13.5l6 6 6-6' />
    </Svg>
  );
}

export function ReplayIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='M4 12a8 8 0 1 0 2.4-5.7' />
      <path d='M4 4.5v4.25h4.25' />
    </Svg>
  );
}

export function UserPlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx='10' cy='8.5' r='3.5' />
      <path d='M3.5 20c.7-3.5 3.3-5.5 6.5-5.5 1.6 0 3 .5 4.1 1.3' />
      <path d='M18.5 14v6M15.5 17h6' />
    </Svg>
  );
}

export function TaskIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x='4' y='4' width='16' height='16' rx='3' />
      <path d='m8.5 12 2.5 2.5 4.5-5' />
    </Svg>
  );
}

function PlaneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='M21 4 3 11l6.5 2.5L12 20l3-4.5 4.5 3Z' />
      <path d='m9.5 13.5 7-5.5' />
    </Svg>
  );
}

function HashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='M9.5 4 8 20M16 4l-1.5 16M4.5 9h15.5M4 15h15.5' />
    </Svg>
  );
}

function CardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x='3' y='5.5' width='18' height='13' rx='2' />
      <path d='M3 10h18M7 15h3' />
    </Svg>
  );
}

function MailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x='3' y='5.5' width='18' height='13' rx='2' />
      <path d='m4 7 8 6 8-6' />
    </Svg>
  );
}

function GridIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x='4' y='4' width='16' height='16' rx='2' />
      <path d='M4 9.5h16M4 15h16M10 4v16' />
    </Svg>
  );
}

function ChatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4V16h0A1.5 1.5 0 0 1 4 14.5Z' />
    </Svg>
  );
}

function LedgerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d='M6 3.5h9.5L19 7v13.5H6Z' />
      <path d='M9 11h7M9 14.5h7M9 18h4' />
    </Svg>
  );
}

export const MODULE_ICONS: Record<ModuleId | 'settings', (props: IconProps) => ReactNode> = {
  pipeline: PipelineIcon,
  roles: RolesIcon,
  automations: AutomationsIcon,
  reports: ReportsIcon,
  integrations: IntegrationsIcon,
  settings: SettingsIcon,
};

/** The alert channel's glyph: Telegram in so'm markets, a team-chat channel for dollars. */
export const ALERT_ICONS: Record<AlertChannel, (props: IconProps) => ReactNode> = {
  telegram: PlaneIcon,
  slack: HashIcon,
};

/** The messenger tile takes its market's alert glyph (ALERT_ICONS). */
export const CONNECTOR_ICONS: Record<Exclude<ConnectorId, 'messenger'>, (props: IconProps) => ReactNode> = {
  sheets: GridIcon,
  payments: CardIcon,
  accounting: LedgerIcon,
  email: MailIcon,
  sms: ChatIcon,
};
