'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { adminFetch } from '@/modules/admin/utils/adminFetch';
import { AdminLoading } from '@/modules/admin/components';
import type { ProviderBalance, ProviderName } from '@/core/ai';
import type { BriefCaps } from '@/modules/estimator/ai-brief/caps';
import type { BriefProvider } from '@/modules/estimator/ai-brief/chains';
import type { BriefSettings, BriefStats, BriefUsageGroup, BriefUsageSummary } from '@/modules/estimator/model/briefRuns.repository';

interface AdminAiData {
  settings: BriefSettings;
  stats: BriefStats;
  balances: Record<ProviderName, ProviderBalance | null>;
  configured: ProviderName[];
  caps: BriefCaps;
}

/** What the founder weighs when switching (blind 60-case audit + live runs, 2026-10-11). */
const PROVIDER_OPTIONS: { id: BriefProvider; name: string; tagline: string; facts: string[]; backup: string }[] = [
  {
    id: 'kimi',
    name: 'Kimi K3',
    tagline: 'Best quality',
    facts: ['Blind test 4.4 / 5', '≈ $0.05–0.11 a plan (en/ru), ≈ $0.26 (uz)', '40–70 s per plan'],
    backup: 'DeepSeek Flash answers if Kimi fails',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Flash',
    tagline: 'Cheapest and fastest',
    facts: ['Blind test 4.0 / 5', '≈ $0.01–0.03 a plan', '≈ 25 s per plan'],
    backup: 'Kimi answers if DeepSeek fails',
  },
];

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7 days' },
  { id: 'month', label: '30 days' },
  { id: 'allTime', label: 'All time' },
] as const;
type PeriodId = (typeof PERIODS)[number]['id'];

const PROVIDER_LABEL: Record<string, string> = { kimi: 'Kimi', deepseek: 'DeepSeek' };
const LOCALE_LABEL: Record<string, string> = { uz: 'Uzbek', ru: 'Russian', en: 'English' };
const STATUS_LABEL: Record<string, string> = {
  ok: 'plan',
  rejected: 'rejected',
  declined_policy: 'declined',
  error: 'failed',
  busy: 'cap reached',
};

function usd(n: number): string {
  if (n === 0) return '$0';
  return n < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
}

function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function seconds(ms: number | null): string {
  return ms == null ? '—' : `${Math.round(ms / 1000)} s`;
}

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-ember-surface rounded-xl border border-ember-border p-5 ${className}`}>
      {title && <h2 className='text-sm font-semibold text-ember-muted uppercase tracking-wide mb-4'>{title}</h2>}
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className='bg-ember-surface rounded-xl border border-ember-border p-4'>
      <div className='text-xs text-ember-muted'>{label}</div>
      <div className='mt-1 text-2xl font-bold text-ember-text tabular-nums'>{value}</div>
      {hint && <div className='mt-1 text-xs text-ember-muted'>{hint}</div>}
    </div>
  );
}

function Meter({ label, spent, cap }: { label: string; spent: number; cap: number }) {
  const pct = Math.min(100, cap > 0 ? (spent / cap) * 100 : 0);
  return (
    <div>
      <div className='flex justify-between text-sm'>
        <span className='text-ember-text'>{label}</span>
        <span className='text-ember-muted tabular-nums'>
          {usd(spent)} of {usd(cap)}
        </span>
      </div>
      <div className='mt-2 h-2 rounded-full bg-ember-surface2 overflow-hidden'>
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-400' : 'bg-ember-accent'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ProviderSwitch({
  settings,
  configured,
  onChange,
  saving,
}: {
  settings: BriefSettings;
  configured: ProviderName[];
  onChange: (provider: BriefProvider) => void;
  saving: boolean;
}) {
  return (
    <Card title='Who writes the plans'>
      <div className='grid gap-3 sm:grid-cols-2' role='radiogroup' aria-label='AI provider'>
        {PROVIDER_OPTIONS.map(option => {
          const isActive = settings.provider === option.id;
          const hasKey = configured.includes(option.id);
          return (
            <button
              key={option.id}
              type='button'
              role='radio'
              aria-checked={isActive}
              disabled={saving || isActive}
              onClick={() => onChange(option.id)}
              className={`text-left rounded-xl border p-4 transition-colors disabled:cursor-default ${
                isActive ? 'border-ember-accent bg-ember-surface2' : 'border-ember-border hover:border-ember-muted'
              }`}
            >
              <div className='flex items-center justify-between gap-2'>
                <span className='text-lg font-semibold text-ember-text'>{option.name}</span>
                {isActive && <span className='text-xs font-medium text-ember-accent'>{saving ? 'Saving…' : 'Active'}</span>}
              </div>
              <div className='text-sm text-ember-accent mt-0.5'>{option.tagline}</div>
              <ul className='mt-3 space-y-1 text-sm text-ember-muted'>
                {option.facts.map(fact => (
                  <li key={fact}>{fact}</li>
                ))}
                <li>{option.backup}</li>
              </ul>
              {!hasKey && <div className='mt-3 text-xs text-red-400'>No API key on this deployment — the backup will answer instead.</div>}
            </button>
          );
        })}
      </div>
      <p className='mt-4 text-xs text-ember-muted'>
        {settings.updatedAt ? `Last changed ${format(new Date(settings.updatedAt), 'MMM dd, HH:mm')}. ` : 'Default setting. '}A change
        reaches every server within 30 seconds. When today&apos;s main cap is spent, plans continue on DeepSeek Flash under the overflow
        cap.
      </p>
    </Card>
  );
}

function Balances({ balances }: { balances: AdminAiData['balances'] }) {
  return (
    <Card title='Account balance (live)'>
      <div className='grid grid-cols-2 gap-4'>
        {(['kimi', 'deepseek'] as const).map(provider => {
          const balance = balances[provider];
          return (
            <div key={provider}>
              <div className='text-xs text-ember-muted'>{PROVIDER_LABEL[provider]}</div>
              <div className='mt-1 text-2xl font-bold text-ember-text tabular-nums'>
                {balance ? `${balance.currency === 'USD' ? '$' : `${balance.currency} `}${balance.amount.toFixed(2)}` : '—'}
              </div>
            </div>
          );
        })}
      </div>
      <p className='mt-4 text-xs text-ember-muted'>Real money left on each account, read from the provider now.</p>
    </Card>
  );
}

function PeriodStats({ summary }: { summary: BriefUsageSummary }) {
  const perPlan = summary.delivered > 0 ? summary.costUsd / summary.delivered : 0;
  const notDelivered = [
    summary.rejected && `${summary.rejected} rejected`,
    summary.failed && `${summary.failed} failed`,
    summary.busy && `${summary.busy} hit the cap`,
  ].filter(Boolean);
  return (
    <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
      <Stat label='People' value={String(summary.visitors)} hint={`${summary.servedVisitors} got a plan`} />
      <Stat
        label='Plans delivered'
        value={String(summary.delivered)}
        hint={notDelivered.length ? notDelivered.join(' · ') : `${summary.requests} requests`}
      />
      <Stat
        label='Spent on tokens'
        value={usd(summary.costUsd)}
        hint={`Kimi ${usd(summary.kimiCostUsd)} · DeepSeek ${usd(summary.deepseekCostUsd)}`}
      />
      <Stat label='Cost per plan' value={summary.delivered ? usd(perPlan) : '—'} hint='incl. rejected tries' />
      <Stat label='Average time' value={seconds(summary.avgMs)} hint='per delivered plan' />
      <Stat label='Requests' value={String(summary.requests)} />
      <Stat
        label='Tokens'
        value={tokens(summary.inputTokens + summary.outputTokens)}
        hint={`${tokens(summary.inputTokens)} in · ${tokens(summary.outputTokens)} out`}
      />
      <Stat label='Backup used' value={String(summary.fallbacks)} hint='the other provider answered a call' />
    </div>
  );
}

function GroupTable({ title, rows, label }: { title: string; rows: BriefUsageGroup[]; label: (key: string) => string }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className='text-sm text-ember-muted'>No requests yet.</p>
      ) : (
        <table className='w-full text-sm'>
          <thead className='text-ember-muted'>
            <tr>
              <th className='text-left font-medium pb-2' />
              <th className='text-right font-medium pb-2'>Requests</th>
              <th className='text-right font-medium pb-2'>Plans</th>
              <th className='text-right font-medium pb-2'>Spent</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-ember-border'>
            {rows.map(row => (
              <tr key={row.key} className='text-ember-text'>
                <td className='py-2'>{label(row.key)}</td>
                <td className='py-2 text-right tabular-nums'>{row.requests}</td>
                <td className='py-2 text-right tabular-nums'>{row.delivered}</td>
                <td className='py-2 text-right tabular-nums'>{usd(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function DailyTable({ days }: { days: BriefStats['days'] }) {
  const maxCost = Math.max(0.0001, ...days.map(d => d.costUsd));
  return (
    <Card title='Last 30 days (Tashkent time)'>
      {days.length === 0 ? (
        <p className='text-sm text-ember-muted'>No requests yet.</p>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='text-ember-muted'>
              <tr>
                <th className='text-left font-medium pb-2'>Day</th>
                <th className='text-right font-medium pb-2'>People</th>
                <th className='text-right font-medium pb-2'>Requests</th>
                <th className='text-right font-medium pb-2'>Plans</th>
                <th className='text-right font-medium pb-2 pl-4'>Spent</th>
                <th className='pb-2 w-1/3' />
              </tr>
            </thead>
            <tbody className='divide-y divide-ember-border'>
              {days.map(d => (
                <tr key={d.day} className='text-ember-text'>
                  <td className='py-2 whitespace-nowrap'>{format(new Date(`${d.day}T12:00:00`), 'EEE, MMM dd')}</td>
                  <td className='py-2 text-right tabular-nums'>{d.visitors}</td>
                  <td className='py-2 text-right tabular-nums'>{d.requests}</td>
                  <td className='py-2 text-right tabular-nums'>{d.delivered}</td>
                  <td className='py-2 text-right tabular-nums pl-4'>{usd(d.costUsd)}</td>
                  <td className='py-2 pl-4'>
                    <div className='h-2 rounded-full bg-ember-accent/70' style={{ width: `${(d.costUsd / maxCost) * 100}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function RecentTable({ runs }: { runs: BriefStats['recent'] }) {
  return (
    <Card title='Latest requests'>
      {runs.length === 0 ? (
        <p className='text-sm text-ember-muted'>No requests yet. Rows appear here as visitors use the AI plan on the site.</p>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='text-ember-muted'>
              <tr>
                <th className='text-left font-medium pb-2 pr-4'>Time</th>
                <th className='text-left font-medium pb-2 pr-4'>Language</th>
                <th className='text-left font-medium pb-2 pr-4'>Provider</th>
                <th className='text-left font-medium pb-2 pr-4'>Result</th>
                <th className='text-right font-medium pb-2 pr-4'>Spent</th>
                <th className='text-right font-medium pb-2 pr-4'>Time taken</th>
                <th className='text-right font-medium pb-2'>Tokens</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-ember-border'>
              {runs.map(run => (
                <tr key={run.createdAt + run.status} className='text-ember-text'>
                  <td className='py-2 pr-4 whitespace-nowrap text-ember-muted'>{format(new Date(run.createdAt), 'MMM dd, HH:mm')}</td>
                  <td className='py-2 pr-4'>{LOCALE_LABEL[run.locale] ?? run.locale}</td>
                  <td className='py-2 pr-4 whitespace-nowrap'>
                    {PROVIDER_LABEL[run.mode] ?? run.mode}
                    {run.lane === 'overflow' && <span className='text-ember-muted'> · overflow</span>}
                    {run.fallbackUsed && <span className='text-ember-muted'> · backup</span>}
                  </td>
                  <td
                    className={`py-2 pr-4 whitespace-nowrap ${run.status === 'ok' ? 'text-green-400' : run.status === 'error' ? 'text-red-400' : 'text-ember-muted'}`}
                  >
                    {STATUS_LABEL[run.status] ?? run.status}
                    {run.errorCode && ` (${run.errorCode})`}
                  </td>
                  <td className='py-2 pr-4 text-right tabular-nums'>{usd(run.costUsd)}</td>
                  <td className='py-2 pr-4 text-right tabular-nums'>{run.status === 'busy' ? '—' : seconds(run.ms)}</td>
                  <td className='py-2 text-right tabular-nums'>{tokens(run.inputTokens + run.outputTokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function AdminAiDemoPage() {
  const [data, setData] = useState<AdminAiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<PeriodId>('today');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminFetch('/api/admin/ai-brief');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeProvider = async (provider: BriefProvider) => {
    if (!data) return;
    const previous = data.settings;
    setSaving(true);
    setData({ ...data, settings: { ...previous, provider } });
    try {
      const res = await adminFetch('/api/admin/ai-brief', { method: 'PUT', body: JSON.stringify({ provider }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setData(current => (current ? { ...current, settings: json.data.settings } : current));
    } catch (e) {
      setData(current => (current ? { ...current, settings: previous } : current));
      setError(`Could not switch: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-ember-surface2 flex items-center justify-center'>
        <AdminLoading message='Loading AI demo stats...' />
      </div>
    );
  }

  return (
    <div className='page-layout min-h-screen bg-ember-surface2'>
      <div className='bg-ember-surface border-b border-ember-border'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-end justify-between gap-4'>
          <div>
            <h1 className='text-3xl font-bold text-ember-text font-display'>AI demo</h1>
            <p className='mt-1 text-sm text-ember-muted'>Who writes the AI project plans, how many people use them and what they cost.</p>
          </div>
          <button
            type='button'
            onClick={() => {
              setLoading(true);
              load();
            }}
            className='text-sm text-ember-muted hover:text-ember-text border border-ember-border rounded-lg px-3 py-1.5'
          >
            Refresh
          </button>
        </div>
      </div>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6'>
        {error && <div className='rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300'>{error}</div>}

        {data && (
          <>
            <ProviderSwitch settings={data.settings} configured={data.configured} onChange={changeProvider} saving={saving} />

            <div className='grid gap-6 lg:grid-cols-2'>
              <Balances balances={data.balances} />
              <Card title="Today's spending caps">
                <div className='space-y-4'>
                  <Meter label='Main' spent={data.stats.capDay.mainUsd} cap={data.caps.mainUsd} />
                  <Meter label='Overflow (DeepSeek Flash)' spent={data.stats.capDay.overflowUsd} cap={data.caps.overflowUsd} />
                </div>
                <p className='mt-4 text-xs text-ember-muted'>
                  Resets at 05:00 Tashkent time. Each visitor gets one free plan a day. When both caps are spent, the site asks visitors to
                  come back tomorrow.
                </p>
              </Card>
            </div>

            <div>
              <div className='flex gap-2 mb-3' role='tablist' aria-label='Period'>
                {PERIODS.map(p => (
                  <button
                    key={p.id}
                    type='button'
                    role='tab'
                    aria-selected={period === p.id}
                    onClick={() => setPeriod(p.id)}
                    className={`text-sm rounded-lg px-3 py-1.5 border transition-colors ${
                      period === p.id
                        ? 'border-ember-accent text-ember-text bg-ember-surface'
                        : 'border-ember-border text-ember-muted hover:text-ember-text'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <PeriodStats summary={data.stats[period]} />
            </div>

            <DailyTable days={data.stats.days} />

            <div className='grid gap-6 lg:grid-cols-2'>
              <GroupTable title='By language (30 days)' rows={data.stats.byLocale} label={key => LOCALE_LABEL[key] ?? key} />
              <GroupTable title='By provider (30 days)' rows={data.stats.byProvider} label={key => PROVIDER_LABEL[key] ?? key} />
            </div>

            <RecentTable runs={data.stats.recent} />

            <p className='text-xs text-ember-muted'>
              Spending is estimated per call from list prices (Kimi as an upper bound, DeepSeek +20% margin), so it may read a little higher
              than the bill. The account balances above are the real numbers. No idea text or IP address is stored: people are counted by an
              anonymous hash.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
