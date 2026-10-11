'use client';

import { useTranslations } from 'next-intl';
import type { WireframeScreen } from '@/modules/estimator/ai-brief/types';
import Wireframe, { describeBlocks } from './wireframe/Wireframe';
import css from './brief.module.css';

/**
 * What a brief draws, shown before the visitor has typed anything: one phone
 * screen and one admin screen for a sample studio, built from the same block
 * vocabulary the AI answers in. Drawn in once, on load.
 */
export default function SampleSketch() {
  const t = useTranslations('aiBrief.sample');
  // Item lists are stored pipe-separated: next-intl message values are strings.
  const list = (key: 'tabs' | 'list' | 'cards' | 'nav' | 'adminNav' | 'adminStats' | 'adminTable') => t(key).split('|');

  const phone: WireframeScreen = {
    name: t('name'),
    purpose: '',
    device: 'phone',
    phase: 'mvp',
    blocks: [
      { kind: 'header', label: t('header'), items: [] },
      { kind: 'search', label: t('search'), items: [] },
      { kind: 'tabs', label: '', items: list('tabs') },
      { kind: 'list', label: '', items: list('list') },
      { kind: 'button', label: t('button'), items: [] },
      { kind: 'card-grid', label: t('featured'), items: list('cards') },
      { kind: 'nav-bar', label: '', items: list('nav') },
    ],
  };
  const admin: WireframeScreen = {
    name: t('adminName'),
    purpose: '',
    device: 'browser',
    phase: 'mvp',
    blocks: [
      { kind: 'header', label: t('adminHeader'), items: [] },
      { kind: 'nav-bar', label: '', items: list('adminNav') },
      { kind: 'stats', label: '', items: list('adminStats') },
      { kind: 'calendar', label: t('adminName'), items: [] },
      { kind: 'table', label: '', items: list('adminTable') },
    ],
  };

  return (
    <figure className={css.sample}>
      <div className={css.sampleStage}>
        <div className={css.sampleBack}>
          <Wireframe screen={admin} label={t('adminName')} isAnimated delayMs={150} />
        </div>
        <div className={css.sampleFront}>
          <Wireframe screen={phone} label={describeBlocks(phone)} isAnimated delayMs={420} />
        </div>
      </div>
      <figcaption className={css.sampleCaption}>{t('caption')}</figcaption>
    </figure>
  );
}
