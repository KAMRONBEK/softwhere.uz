'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import type { AiBrief, BriefPreview, ScopeItem } from '@/modules/estimator/ai-brief/types';
import css from './brief.module.css';

type ScopeEntry = ScopeItem & { labelKey: string };

function WritingSkeleton({ label }: { label: string }) {
  return (
    <div className={css.writing}>
      <span className={css.srOnly}>{label}</span>
      <span className={`${css.skel} ${css.skelLine}`} aria-hidden />
      <span className={`${css.skel} ${css.skelLine}`} aria-hidden />
      <span className={`${css.skel} ${css.skelLine} ${css.skelShort}`} aria-hidden />
    </div>
  );
}

/** "Build this first": the verdict, set larger than everything around it. */
export function BuildFirst({ brief }: { brief: AiBrief | null }) {
  const t = useTranslations('aiBrief.result');
  const headingId = useId();
  return (
    <section className={`${css.planSection} ${css.buildFirst}`} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.sectionTitle}>
        {t('buildFirst')}
      </h3>
      {brief ? (
        <div className={css.reveal}>
          <p className={css.buildWhat}>{brief.narrative.buildFirst.what}</p>
          <p className={css.buildWhy}>
            <span className={css.buildWhyLabel}>{t('why')}</span>
            {brief.narrative.buildFirst.why}
          </p>
        </div>
      ) : (
        <WritingSkeleton label={t('writing')} />
      )}
    </section>
  );
}

function ScopeList({ items }: { items: ScopeEntry[] }) {
  const tEstimator = useTranslations('estimator');
  const tx = tEstimator as unknown as (key: string) => string;
  return (
    <ul className={css.scopeList}>
      {items.map(item => (
        <li key={item.id} className={css.scopeItem}>
          <span className={css.scopeName}>{tx(item.labelKey)}</span>
          {item.note && <span className={css.scopeNote}>{item.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/** What the first version contains vs what is planned for later — the scope the engine priced. */
export function ScopeSplit({ preview }: { preview: BriefPreview }) {
  const t = useTranslations('aiBrief.result');
  const headingId = useId();
  const mvpFeatures = preview.features.filter(f => f.phase === 'mvp');
  const laterFeatures = preview.features.filter(f => f.phase === 'later');
  const mvpIntegrations = preview.integrations.filter(i => i.phase === 'mvp');
  const laterIntegrations = preview.integrations.filter(i => i.phase === 'later');
  const hasLater = laterFeatures.length + laterIntegrations.length > 0;

  return (
    <section className={`${css.planSection} ${css.reveal}`} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.srOnly}>
        {t('scopeMvp')}
      </h3>
      <div className={hasLater ? css.scopeGrid : undefined}>
        <div className={css.scopeCol}>
          <h4 className={css.scopeHeading}>
            <span className={css.scopeMarkNow} aria-hidden />
            {t('scopeMvp')}
          </h4>
          <ScopeList items={mvpFeatures} />
          {mvpIntegrations.length > 0 && (
            <>
              <h5 className={css.scopeSubheading}>{t('integrations')}</h5>
              <ScopeList items={mvpIntegrations} />
            </>
          )}
        </div>
        {hasLater && (
          <div className={`${css.scopeCol} ${css.scopeLater}`}>
            <h4 className={css.scopeHeading}>
              <span className={css.scopeMarkLater} aria-hidden />
              {t('scopeLater')}
            </h4>
            <ScopeList items={laterFeatures} />
            {laterIntegrations.length > 0 && (
              <>
                <h5 className={css.scopeSubheading}>{t('integrations')}</h5>
                <ScopeList items={laterIntegrations} />
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function CanWait({ brief }: { brief: AiBrief }) {
  const t = useTranslations('aiBrief.result');
  const headingId = useId();
  const { canWait } = brief.narrative;
  if (canWait.length === 0) return null;
  return (
    <section className={`${css.planSection} ${css.reveal}`} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.sectionTitle}>
        {t('canWait')}
      </h3>
      <ul className={css.waitList}>
        {canWait.map(item => (
          <li key={item.item}>
            <span className={css.waitItem}>
              {item.item}
              {!item.inEstimate && <span className={css.notPriced}>{t('notPriced')}</span>}
            </span>
            <span className={css.waitReason}>{item.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Risks({ brief }: { brief: AiBrief }) {
  const t = useTranslations('aiBrief.result');
  const headingId = useId();
  const { risks } = brief.narrative;
  if (risks.length === 0) return null;
  return (
    <section className={`${css.planSection} ${css.reveal}`} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.sectionTitle}>
        {t('risks')}
      </h3>
      <ul className={css.risks}>
        {risks.map(risk => (
          <li key={risk.title} className={css.risk}>
            <h4 className={css.riskTitle}>{risk.title}</h4>
            <p className={css.riskDetail}>{risk.detail}</p>
            <p className={css.riskFix}>
              <span className={css.riskFixLabel}>{t('mitigation')}</span>
              {risk.mitigation}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Questions({ brief }: { brief: AiBrief }) {
  const t = useTranslations('aiBrief.result');
  const headingId = useId();
  const { questions } = brief.narrative;
  if (questions.length === 0) return null;
  return (
    <section className={`${css.planSection} ${css.reveal}`} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.sectionTitle}>
        {t('questions')}
      </h3>
      <ul className={css.questions}>
        {questions.map(question => (
          <li key={question}>{question}</li>
        ))}
      </ul>
    </section>
  );
}
