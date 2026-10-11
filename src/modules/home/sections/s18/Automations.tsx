'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RULE_IDS } from './data';
import { formatClock, type Demo, type RuleRun } from './demo';
import { ALERT_ICONS, TaskIcon, UserPlusIcon } from './icons';
import css from './flow.module.css';

/**
 * One run: 1 lead arrives → 2 signal travels → 3 alert →
 * 4 signal travels → 5 task created. Delays (ms) before each next step.
 */
const STEP_DELAYS = [0, 650, 650, 850, 650];
const LAST_STEP = 5;
const FIRST_RUN_DELAY = 700;
const NEXT_RUN_DELAY = 3000;
/** The visitor's runs land in the log from 9:14, a few minutes apart. */
const FIRST_RUN_AT = 9 * 60 + 14;
const RUN_SPACING_MIN = 4;
const LOG_LENGTH = 8;

interface AutomationsProps {
  demo: Demo;
  isActive: boolean;
  isPlaying: boolean;
  isReduced: boolean;
  /** A finished run (the top bar's bell counts them). */
  onRun: () => void;
}

type ConnectorState = 'idle' | 'flowing' | 'done';

function connectorState(step: number, flowStep: number): ConnectorState {
  if (step < flowStep) return 'idle';
  return step === flowStep ? 'flowing' : 'done';
}

/**
 * A step's body: what the rule does (until a run reaches it) and what this
 * run did, stacked in one cell so the node never changes height.
 */
function NodeBody({ rule, isLit, runKey, children }: { rule: string; isLit: boolean; runKey: string; children: ReactNode }) {
  return (
    <span className={css.stack}>
      <span className={css.rule} data-shown={isLit ? undefined : ''} aria-hidden={isLit ? true : undefined}>
        {rule}
      </span>
      <span key={runKey} className={css.live} data-shown={isLit ? '' : undefined} aria-hidden={isLit ? undefined : true}>
        {children}
      </span>
    </span>
  );
}

/**
 * Automations: "when a new lead arrives, alert the manager and create a call
 * task", running for real in front of the visitor. Three sample leads run by
 * themselves while the module is on screen; "Send a test lead" runs one more
 * any time. Under the rule: the business's other rules and a run log that
 * ticks as runs finish. Reduced motion: each run lands on its finished state
 * at once.
 */
export default function Automations({ demo, isActive, isPlaying, isReduced, onRun }: AutomationsProps) {
  const t = useTranslations('home.crm-build');
  const [step, setStep] = useState(0);
  const [lead, setLead] = useState(0);
  /** The leads of the runs finished so far, oldest first. */
  const [finished, setFinished] = useState<readonly number[]>([]);
  const [autoRuns, setAutoRuns] = useState(0);
  /** Bumps when a run starts, so each run's cards pop in fresh. */
  const [runId, setRunId] = useState(0);
  const onRunRef = useRef(onRun);
  const autoRunCount = demo.leads.length;

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  const isRunning = step > 0 && step < LAST_STEP;

  // Advance a run step by step (only while visible; it resumes where it was).
  useEffect(() => {
    if (!isRunning || !isPlaying) return;
    const id = window.setTimeout(() => {
      const next = step + 1;
      setStep(next);
      if (next === LAST_STEP) {
        setFinished(prev => [...prev, lead]);
        onRunRef.current();
      }
    }, STEP_DELAYS[step]);
    return () => window.clearTimeout(id);
  }, [step, isRunning, isPlaying, lead]);

  // The first runs start themselves while the module is showing.
  useEffect(() => {
    if (isReduced || !isActive || !isPlaying || isRunning || autoRuns >= autoRunCount) return;
    const delay = step === 0 ? FIRST_RUN_DELAY : NEXT_RUN_DELAY;
    const id = window.setTimeout(() => {
      setLead(autoRuns % autoRunCount);
      setAutoRuns(n => n + 1);
      setRunId(n => n + 1);
      setStep(1);
    }, delay);
    return () => window.clearTimeout(id);
  }, [isReduced, isActive, isPlaying, isRunning, autoRuns, step, autoRunCount]);

  // Reduced motion opens on a finished first run (nothing plays by itself).
  const isStill = isReduced && runId === 0;
  const shownStep = isStill ? LAST_STEP : step;
  const shownFinished = isStill ? [0] : finished;

  const sendTestLead = () => {
    if (isRunning) return;
    const nextLead = shownStep === 0 ? lead : (lead + 1) % autoRunCount;
    setAutoRuns(autoRunCount);
    setLead(nextLead);
    setRunId(n => n + 1);
    if (isReduced) {
      setStep(LAST_STEP);
      setFinished(prev => [...(isStill ? [0] : prev), nextLead]);
      onRun();
    } else {
      setStep(1);
    }
  };

  const current = demo.leads[lead];
  const AlertIcon = ALERT_ICONS[demo.alert.channel];
  const visitorRuns: RuleRun[] = shownFinished.map((index, order) => ({
    at: FIRST_RUN_AT + order * RUN_SPACING_MIN,
    rule: t('automation.rules.lead.when'),
    text: t('automation.log.lead', { client: demo.leads[index].client, manager: demo.leads[index].manager }),
  }));
  const log = [...[...visitorRuns].reverse(), ...demo.earlierRuns].slice(0, LOG_LENGTH);

  return (
    <div className={css.flow}>
      <div className={css.head}>
        <span className={css.title}>{t('automation.title')}</span>
        <button type='button' className={css.button} onClick={sendTestLead} disabled={isRunning} data-magnetic>
          {isRunning ? t('automation.running') : t('automation.button')}
        </button>
      </div>

      <ol className={css.chain}>
        <li className={css.node} data-lit={shownStep >= 1 ? '' : undefined}>
          <span className={css.kicker}>
            <UserPlusIcon className={css.kickerIcon} />
            {t('automation.kickers.when')} · {t('automation.lead')}
          </span>
          <NodeBody rule={demo.leadSources} isLit={shownStep >= 1} runKey={`lead-${runId}`}>
            <span className={css.body}>
              <span className={css.strong}>{current.client}</span>
              <span className={css.soft}>{current.item}</span>
              <span className={css.source}>{current.source}</span>
            </span>
          </NodeBody>
        </li>

        <li className={css.connector} data-state={connectorState(shownStep, 2)} aria-hidden='true'>
          <span className={css.line} />
        </li>

        <li className={css.node} data-lit={shownStep >= 3 ? '' : undefined}>
          <span className={css.kicker}>
            <AlertIcon className={css.kickerIcon} />
            {t('automation.kickers.then')} · {demo.alert.title}
          </span>
          <NodeBody rule={t('automation.notifyRule')} isLit={shownStep >= 3} runKey={`msg-${runId}`}>
            <span className={`${css.body} ${css.message}`}>
              <span className={css.bot}>{demo.alert.bot}</span>
              <span className={css.bubble}>
                {t('automation.message', {
                  client: current.client,
                  item: current.item.toLowerCase(),
                  source: current.source,
                  manager: current.manager,
                })}
              </span>
            </span>
          </NodeBody>
        </li>

        <li className={css.connector} data-state={connectorState(shownStep, 4)} aria-hidden='true'>
          <span className={css.line} />
        </li>

        <li className={css.node} data-lit={shownStep >= LAST_STEP ? '' : undefined}>
          <span className={css.kicker}>
            <TaskIcon className={css.kickerIcon} />
            {t('automation.kickers.and')} · {t('automation.task')}
          </span>
          <NodeBody rule={t('automation.taskRule')} isLit={shownStep >= LAST_STEP} runKey={`task-${runId}`}>
            <span className={`${css.body} ${css.task}`}>
              <span className={css.checkbox} aria-hidden='true' />
              <span className={css.taskText}>
                <span className={css.strong}>{t('automation.taskTitle', { client: current.client })}</span>
                <span className={css.soft}>
                  {t('automation.due')} · {current.manager}
                </span>
              </span>
            </span>
          </NodeBody>
        </li>
      </ol>

      <p className={css.note}>{t('automation.ruleNote')}</p>

      <div className={css.lower}>
        <section className={css.panel} aria-label={t('automation.rulesTitle')} data-panel='rules'>
          <span className={css.panelHead}>
            <span className={css.panelTitle}>{t('automation.rulesTitle')}</span>
            <span className={css.panelMeta}>{t('automation.rulesCount', { count: RULE_IDS.length })}</span>
          </span>
          <ul className={css.rules}>
            {RULE_IDS.map((rule, index) => (
              <li key={rule} className={css.ruleRow} data-current={index === 0 ? '' : undefined}>
                <span className={css.ruleText}>
                  <span className={css.ruleWhen}>{t(`automation.rules.${rule}.when`)}</span>
                  <span className={css.ruleThen}>{t(`automation.rules.${rule}.then`)}</span>
                </span>
                <span className={css.toggle} aria-hidden='true' />
              </li>
            ))}
          </ul>
        </section>

        <section className={css.panel} aria-label={t('automation.logTitle')} data-panel='log'>
          <span className={css.panelHead}>
            <span className={css.panelTitle}>{t('automation.logTitle')}</span>
            <span className={css.panelMeta} aria-live='polite'>
              {t('automation.runs', { count: demo.earlierRuns.length + shownFinished.length })}
            </span>
          </span>
          <ol className={css.log}>
            {log.map(entry => (
              <li key={`${entry.at}-${entry.rule}`} className={css.logRow}>
                <span className={css.logTime}>{formatClock(entry.at, demo.currency)}</span>
                <span className={css.logText}>
                  <span className={css.logRule}>{entry.rule}</span> {entry.text}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
