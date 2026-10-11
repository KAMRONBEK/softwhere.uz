/**
 * Section 11 · CRM & Admin: the demo's fixed data. Every word a visitor reads
 * lives in src/messages/home/crm-build/<locale>.json (read with
 * useTranslations('home.crm-build')); this file keeps the ids, amounts and
 * structure. The route locale picks the market through the currency, like
 * 07: so'm for uz/ru, dollars for en; the per-market names, phones, tools and
 * shares live in demo.ts, and each locale's messages carry its own market's
 * wording (Slack and Google Ads in English, Telegram and Click · Payme in
 * Uzbek and Russian).
 *
 * Nothing here claims a client, a number or an award. The business is the
 * visitor's own ("Your Showroom", a furniture showroom); its customers, staff
 * and figures are invented for the demo and labelled as sample data. The
 * shipped-work line is derived from projects.ts (see proof.ts) and names no
 * project: the founder keeps real names for the work wall.
 */

export type Currency = 'usd' | 'uzs';
export type StageId = 'new' | 'quote' | 'won';
export type DealId = 'dilnoza' | 'jasur' | 'malika' | 'bekzod' | 'nodira' | 'timur';
export type ManagerId = 'aziz' | 'sardor';
export type RoleId = 'owner' | 'sales' | 'support';
export type ModuleId = 'pipeline' | 'roles' | 'automations' | 'reports' | 'integrations';
export type ChapterId = 'sheet' | ModuleId;

/** A deal's fixed facts; its item is `deals.<id>`, the client's name comes from the market (demo.ts). */
export interface Deal {
  id: DealId;
  /** Whole dollars / whole so'm. */
  amount: Record<Currency, number>;
  manager: ManagerId;
}

export const DEALS: readonly Deal[] = [
  { id: 'jasur', amount: { usd: 2550, uzs: 31_500_000 }, manager: 'aziz' },
  { id: 'bekzod', amount: { usd: 620, uzs: 7_600_000 }, manager: 'sardor' },
  { id: 'dilnoza', amount: { usd: 1150, uzs: 14_200_000 }, manager: 'aziz' },
  { id: 'nodira', amount: { usd: 3240, uzs: 40_000_000 }, manager: 'sardor' },
  { id: 'malika', amount: { usd: 790, uzs: 9_800_000 }, manager: 'sardor' },
  { id: 'timur', amount: { usd: 920, uzs: 11_400_000 }, manager: 'aziz' },
];

/** The board's stages, in order (`stages.<id>`). */
export const STAGE_IDS: readonly StageId[] = ['new', 'quote', 'won'];

/** The board as the spreadsheet left it (statuses read from the messy Status column). */
export const INITIAL_BOARD: Readonly<Record<StageId, readonly DealId[]>> = {
  new: ['jasur', 'bekzod'],
  quote: ['dilnoza', 'nodira'],
  won: ['malika', 'timur'],
};

/** Spreadsheet code: the same in every language, like the grid's letters. */
export const SHEET_FORMULA = '=SUM(D2:D9)';
export const SHEET_ERROR = '#REF!';
export const SHEET_COLUMNS = ['client', 'phone', 'item', 'amount', 'status', 'manager'] as const;
export const SHEET_TABS = ['first', 'second', 'current', 'copy'] as const;

/** The story's chapters, in order (`chapters.<id>`). */
export const CHAPTER_IDS: readonly ChapterId[] = ['sheet', 'pipeline', 'roles', 'automations', 'reports', 'integrations'];

/** "What you get", in order (`deliver.<id>`). */
export const DELIVER_IDS = ['admin', 'roles', 'import', 'process', 'ownership'] as const;

/**
 * What the estimator gives a CRM like this one (web · CRM, MVP, 20 screens,
 * sign-in, roles, dashboard, reports and import/export; computed 2026-10-11):
 * 8–9 weeks on its own, 9–10 with Telegram alerts and a Sheets import.
 */
export const TIMELINE_WEEKS = { min: 8, max: 10 } as const;

/** The owner is the visitor; sales and support are people from the market's team (demo.ts). */
export const ROLE_IDS: readonly RoleId[] = ['owner', 'sales', 'support'];

export type PermissionId = 'amounts' | 'edit' | 'export' | 'settings';
export type Access = 'yes' | 'own' | 'no';

export const PERMISSIONS: ReadonlyArray<{ id: PermissionId; by: Record<RoleId, Access> }> = [
  { id: 'amounts', by: { owner: 'yes', sales: 'own', support: 'no' } },
  { id: 'edit', by: { owner: 'yes', sales: 'own', support: 'no' } },
  { id: 'export', by: { owner: 'yes', sales: 'no', support: 'no' } },
  { id: 'settings', by: { owner: 'yes', sales: 'no', support: 'no' } },
];

/** Sidebar items each role cannot open (shown with a lock while the Roles chapter is on). */
export const LOCKED_NAV: Record<RoleId, ReadonlyArray<ModuleId | 'settings'>> = {
  owner: [],
  sales: ['integrations', 'settings'],
  support: ['reports', 'automations', 'integrations', 'settings'],
};

export type RuleId = 'lead' | 'deposit' | 'noReply' | 'delivery';
/** The rules panel, in order (`automation.rules.<id>`). */
export const RULE_IDS: readonly RuleId[] = ['lead', 'deposit', 'noReply', 'delivery'];

export type ReportMetric = 'revenue' | 'deals';

/** The chart's months (`reports.months.<id>`): five past months of sample data, the sixth is the live board. */
export const MONTH_IDS = ['may', 'jun', 'jul', 'aug', 'sep', 'oct'] as const;

export const REPORT_HISTORY = {
  revenue: { usd: [4200, 5100, 4700, 6300, 5800], uzs: [52_000_000, 63_000_000, 58_000_000, 78_000_000, 72_000_000] },
  deals: [5, 6, 5, 8, 7],
} as const;

/** The CRM's imported spreadsheet: six deals, two rows merged (the toast's numbers). */
export const IMPORTED = { deals: DEALS.length, merged: 2 } as const;

export function currencyForLocale(locale: string): Currency {
  return locale === 'en' ? 'usd' : 'uzs';
}

/** Groups thousands identically on server and client (no Intl differences). */
export function groupThousands(value: number, separator: string): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}
