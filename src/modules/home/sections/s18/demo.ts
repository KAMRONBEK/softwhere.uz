/**
 * The demo business, per market. The route locale picks it through the
 * currency (as 07 does): uz/ru get a Tashkent-style showroom (so'm, +998
 * phones, Telegram alerts, Click · Payme, 1C); en gets the same showroom with
 * English names, US-format phones (555-01xx, the range reserved for fiction),
 * Slack alerts, Stripe and QuickBooks. Every name, number and event here is
 * invented sample data for "Your Showroom", the visitor's own business.
 *
 * Names, phones, amounts, shares and tool names live here; the words around
 * them come from the visitor's messages (buildDemo).
 */
import { DEALS, SHEET_TABS, type Currency, type DealId, type ManagerId, type RoleId, type RuleId } from './data';
import { moneyFor, type CrmT, type Money } from './i18n';

export type Fill = 'yellow' | 'green' | 'red' | 'blue' | 'orange';
export type ConnectorId = 'sheets' | 'messenger' | 'payments' | 'accounting' | 'email' | 'sms';
export type AlertChannel = 'telegram' | 'slack';

export interface Person {
  name: string;
  initials: string;
}

export interface SheetRow {
  /** The deal this row becomes (duplicates merge into their twin). */
  deal: DealId;
  isDuplicate?: boolean;
  client: string;
  phone: string;
  item: string;
  /** Deliberately in mixed formats. */
  amount: string;
  status: string;
  manager: string;
  fill?: Fill;
  statusFill?: Fill;
  isLoud?: boolean;
}

export interface Connector {
  id: ConnectorId;
  name: string;
  role: string;
  /** Drawn as letters instead of an icon (accounting systems have no generic glyph). */
  monogram?: string;
  /** What the tool does once connected: the first on connect, then the activity stream. */
  events: readonly string[];
}

export interface Lead {
  client: string;
  item: string;
  source: string;
  manager: string;
}

export interface RuleRun {
  /** Minutes after midnight. */
  at: number;
  rule: string;
  text: string;
}

export interface Demo {
  currency: Currency;
  money: Money;
  clients: Record<DealId, string>;
  managers: Record<ManagerId, Person>;
  support: Person;
  /** The visitor, who owns the business. */
  owner: Person;
  file: string;
  tabs: readonly string[];
  rows: readonly SheetRow[];
  alert: { channel: AlertChannel; title: string; bot: string };
  /** Where new leads come from, as the automation's trigger describes it. */
  leadSources: string;
  leads: readonly Lead[];
  sources: ReadonlyArray<{ id: SourceId; name: string; share: number }>;
  connectors: readonly Connector[];
  /** The other rules' runs earlier today, newest first (the run log before the visitor's). */
  earlierRuns: readonly RuleRun[];
}

/* ---------------------------------------------------------------- the spreadsheet */

type RowId = 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7' | 'r8';

interface BaseRow {
  /** Its item and status are `sheet.rows.<id>`. */
  id: RowId;
  deal: DealId;
  isDuplicate?: boolean;
  amount: Record<Currency, string>;
  fill?: Fill;
  statusFill?: Fill;
  isLoud?: boolean;
}

/** Eight rows, two of them a client typed again; ordered the way people actually add rows. */
const BASE_ROWS: readonly BaseRow[] = [
  { id: 'r1', deal: 'dilnoza', amount: { usd: '$1150', uzs: '14 200 000' }, statusFill: 'yellow' },
  { id: 'r2', deal: 'jasur', amount: { usd: '2.550$', uzs: '31,5 mln' }, fill: 'yellow', isLoud: true },
  { id: 'r3', deal: 'malika', amount: { usd: '790 usd', uzs: '9.8m' }, statusFill: 'green' },
  { id: 'r4', deal: 'dilnoza', isDuplicate: true, amount: { usd: '1,150', uzs: '14.2 mln' } },
  { id: 'r5', deal: 'bekzod', amount: { usd: '620', uzs: '7 600 000' }, statusFill: 'orange' },
  { id: 'r6', deal: 'nodira', amount: { usd: '#REF!', uzs: '#REF!' }, statusFill: 'blue' },
  { id: 'r7', deal: 'timur', amount: { usd: '$920.00', uzs: '11.4 mln' }, statusFill: 'green' },
  { id: 'r8', deal: 'jasur', isDuplicate: true, amount: { usd: '2550', uzs: '31.5 mln' }, statusFill: 'red' },
];

/** The order rows sit in (the same in every market): the morph lifts cards off in it. */
export const SHEET_ORDER: ReadonlyArray<{ deal: DealId; isDuplicate: boolean }> = BASE_ROWS.map(row => ({
  deal: row.deal,
  isDuplicate: Boolean(row.isDuplicate),
}));

type RowPeople = readonly [client: string, phone: string, manager: string];

/* ---------------------------------------------------------------- the two markets */

type LeadId = 'kitchen' | 'wardrobe' | 'sofa';
type SourceId = 'instagram' | 'website' | 'channel' | 'walkIn' | 'referral';

interface Market {
  currency: Currency;
  clients: Record<DealId, string>;
  managers: Record<ManagerId, Person>;
  support: Person;
  /** The spreadsheet's people, typed as people do (row by row, BASE_ROWS order). */
  rowPeople: readonly RowPeople[];
  alertChannel: AlertChannel;
  leads: ReadonlyArray<{ id: LeadId; client: string; manager: ManagerId }>;
  /** `channel` is the market's own third source (Telegram / Google Ads). */
  sources: ReadonlyArray<{ id: SourceId; share: number }>;
  tools: { messenger: string; payments: string; accounting: string; accountingMark: string };
  /** The deposit the payments tool reports. */
  deposit: number;
}

const HOUR = 60;
const SMS_REMINDER_AT = 10 * HOUR;

const UZS_MARKET: Market = {
  currency: 'uzs',
  clients: {
    jasur: 'Jasur T.',
    bekzod: 'Bekzod A.',
    dilnoza: 'Dilnoza R.',
    nodira: 'Nodira K.',
    malika: 'Malika S.',
    timur: 'Timur Y.',
  },
  managers: { aziz: { name: 'Aziz', initials: 'AZ' }, sardor: { name: 'Sardor', initials: 'SR' } },
  support: { name: 'Laylo', initials: 'LA' },
  rowPeople: [
    ['Dilnoza R.', '+998 90 123 45 67', 'Aziz'],
    ['Jasur T.', '946208815', 'aziz'],
    ['Malika S.', '+998(93)555-12-12', 'Sardor?'],
    ['Dilnoza R', '90 123 45 67', ''],
    ['Bekzod A.', '—', 'Sardor'],
    ['Nodira K.', '+998 97 700 11 22', 'Sardor'],
    ['Timur Y.', '+998 99 301 02 03', 'Aziz'],
    ['Jasur T', '94-620-88-15', 'Aziz'],
  ],
  alertChannel: 'telegram',
  leads: [
    { id: 'kitchen', client: 'Gulnora M.', manager: 'aziz' },
    { id: 'wardrobe', client: 'Rustam K.', manager: 'sardor' },
    { id: 'sofa', client: 'Zarina T.', manager: 'aziz' },
  ],
  sources: [
    { id: 'instagram', share: 36 },
    { id: 'website', share: 24 },
    { id: 'channel', share: 20 },
    { id: 'walkIn', share: 12 },
    { id: 'referral', share: 8 },
  ],
  tools: { messenger: 'Telegram', payments: 'Click · Payme', accounting: '1C', accountingMark: '1C' },
  deposit: 5_000_000,
};

const USD_MARKET: Market = {
  currency: 'usd',
  clients: {
    jasur: 'Jake T.',
    bekzod: 'Ben A.',
    dilnoza: 'Emma R.',
    nodira: 'Nora K.',
    malika: 'Mia S.',
    timur: 'Tom Y.',
  },
  managers: { aziz: { name: 'Alex', initials: 'AL' }, sardor: { name: 'Sam', initials: 'SA' } },
  support: { name: 'Lily', initials: 'LI' },
  rowPeople: [
    ['Emma R.', '+1 (415) 555-0142', 'Alex'],
    ['Jake T.', '4155550176', 'alex'],
    ['Mia S.', '+1 415.555.0119', 'Sam?'],
    ['Emma R', '415-555-0142', ''],
    ['Ben A.', '—', 'Sam'],
    ['Nora K.', '+1 (646) 555-0103', 'Sam'],
    ['Tom Y.', '+1 (312) 555-0188', 'Alex'],
    ['Jake T', '415 555 0176', 'Alex'],
  ],
  alertChannel: 'slack',
  leads: [
    { id: 'kitchen', client: 'Olivia M.', manager: 'aziz' },
    { id: 'wardrobe', client: 'Ryan K.', manager: 'sardor' },
    { id: 'sofa', client: 'Zoe T.', manager: 'aziz' },
  ],
  sources: [
    { id: 'instagram', share: 34 },
    { id: 'website', share: 26 },
    { id: 'channel', share: 18 },
    { id: 'walkIn', share: 12 },
    { id: 'referral', share: 10 },
  ],
  tools: { messenger: 'Slack', payments: 'Stripe', accounting: 'QuickBooks', accountingMark: 'QB' },
  deposit: 400,
};

function connectorsFor(market: Market, money: Money, t: CrmT): Connector[] {
  const { clients, tools } = market;
  const lastLead = market.leads[market.leads.length - 1];
  return [
    {
      id: 'sheets',
      name: 'Google Sheets',
      role: t('integrations.connectors.sheets.role'),
      events: [t('integrations.connectors.sheets.first', { count: DEALS.length }), t('integrations.connectors.sheets.then')],
    },
    {
      id: 'messenger',
      name: tools.messenger,
      role: t('integrations.connectors.messenger.role'),
      events: [t('integrations.connectors.messenger.first', { client: lastLead.client }), t('integrations.connectors.messenger.then')],
    },
    {
      id: 'payments',
      name: tools.payments,
      role: t('integrations.connectors.payments.role'),
      events: [
        t('integrations.connectors.payments.first', { client: clients.dilnoza, amount: money.full(market.deposit) }),
        t('integrations.connectors.payments.then', { client: clients.bekzod }),
      ],
    },
    {
      id: 'accounting',
      name: tools.accounting,
      role: t('integrations.connectors.accounting.role'),
      monogram: tools.accountingMark,
      events: [
        t('integrations.connectors.accounting.first', { client: clients.malika, tool: tools.accounting }),
        t('integrations.connectors.accounting.then', { client: clients.timur, tool: tools.accounting }),
      ],
    },
    {
      id: 'email',
      name: t('integrations.connectors.email.name'),
      role: t('integrations.connectors.email.role'),
      events: [
        t('integrations.connectors.email.first', { client: clients.nodira }),
        t('integrations.connectors.email.then', { client: clients.timur }),
      ],
    },
    {
      id: 'sms',
      name: 'SMS',
      role: t('integrations.connectors.sms.role'),
      events: [
        t('integrations.connectors.sms.first', { time: formatClock(SMS_REMINDER_AT, market.currency) }),
        t('integrations.connectors.sms.then', { client: clients.bekzod }),
      ],
    },
  ];
}

function earlierRunsFor(market: Market, t: CrmT): RuleRun[] {
  const { clients, managers } = market;
  const run = (at: number, rule: RuleId, text: string): RuleRun => ({ at, rule: t(`automation.rules.${rule}.when`), text });
  return [
    run(8 * HOUR + 52, 'deposit', t('automation.log.deposit', { client: clients.timur })),
    run(8 * HOUR + 30, 'delivery', t('automation.log.delivery', { client: clients.malika })),
    run(8 * HOUR + 5, 'noReply', t('automation.log.noReply', { manager: managers.sardor.name, client: clients.bekzod })),
    run(7 * HOUR + 48, 'lead', t('automation.log.lead', { client: clients.nodira, manager: managers.sardor.name })),
    run(7 * HOUR + 30, 'delivery', t('automation.log.delivery', { client: clients.jasur })),
  ];
}

/** The showroom in the visitor's market and language. */
export function buildDemo(currency: Currency, t: CrmT): Demo {
  const market = currency === 'usd' ? USD_MARKET : UZS_MARKET;
  const money = moneyFor(currency, t);
  const manager = market.managers.aziz.name;
  return {
    currency,
    money,
    clients: market.clients,
    managers: market.managers,
    support: market.support,
    owner: { name: t('owner.name'), initials: t('owner.initials') },
    file: t('sheet.file', { manager }),
    tabs: SHEET_TABS.map(tab => t(`sheet.tabs.${tab}`, { manager })),
    rows: BASE_ROWS.map((row, index) => {
      const [client, phone, rowManager] = market.rowPeople[index];
      return {
        deal: row.deal,
        isDuplicate: row.isDuplicate,
        fill: row.fill,
        statusFill: row.statusFill,
        isLoud: row.isLoud,
        amount: row.amount[currency],
        item: t(`sheet.rows.${row.id}.item`),
        status: t(`sheet.rows.${row.id}.status`),
        client,
        phone,
        manager: rowManager,
      };
    }),
    alert: { channel: market.alertChannel, title: t('automation.alertTitle'), bot: t('automation.alertBot') },
    leadSources: t('automation.leadSources'),
    leads: market.leads.map(lead => ({
      client: lead.client,
      item: t(`automation.leads.${lead.id}.item`),
      source: t(`automation.leads.${lead.id}.source`),
      manager: market.managers[lead.manager].name,
    })),
    sources: market.sources.map(source => ({ ...source, name: t(`reports.sources.${source.id}`) })),
    connectors: connectorsFor(market, money, t),
    earlierRuns: earlierRunsFor(market, t),
  };
}

/** Who a role is in this market: the visitor owns the business, Sales and Support are the team. */
export function rolePerson(demo: Demo, role: RoleId): Person {
  if (role === 'sales') return demo.managers.aziz;
  if (role === 'support') return demo.support;
  return demo.owner;
}

/** 24-hour clock for so'm markets, 12-hour for dollars ("09:14" / "9:14 AM"). */
export function formatClock(minutes: number, currency: Currency): string {
  const total = ((Math.round(minutes) % (24 * HOUR)) + 24 * HOUR) % (24 * HOUR);
  const hours = Math.floor(total / HOUR);
  const mins = String(total % HOUR).padStart(2, '0');
  if (currency === 'uzs') return `${String(hours).padStart(2, '0')}:${mins}`;
  const half = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${mins} ${half}`;
}
