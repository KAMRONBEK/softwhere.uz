'use client';

import { useTranslations } from 'next-intl';
import type { Dispatch, RefObject } from 'react';
import Automations from './Automations';
import type { Board, BoardAction, Slot } from './board';
import { LOCKED_NAV, type DealId, type ModuleId, type RoleId } from './data';
import { IMPORTED } from './data';
import { rolePerson, type Demo } from './demo';
import type { CrmEngine } from './engine';
import { BellIcon, CheckIcon, LockIcon, MODULE_ICONS, SearchIcon } from './icons';
import Integrations from './Integrations';
import Pipeline from './Pipeline';
import Reports from './Reports';
import Roles from './Roles';
import Sheet from './Sheet';
import css from './window.module.css';

export const MODULE_IDS: readonly ModuleId[] = ['pipeline', 'roles', 'automations', 'reports', 'integrations'];

interface WindowProps {
  bodyRef: RefObject<HTMLDivElement | null>;
  engineRef: RefObject<CrmEngine | null>;
  slotsRef: RefObject<Map<DealId, Slot> | null>;
  board: Board;
  dispatch: Dispatch<BoardAction>;
  demo: Demo;
  module: ModuleId;
  /** The role the UI renders for (the Roles chapter's pick; the owner elsewhere). */
  role: RoleId;
  onRole: (role: RoleId) => void;
  runs: number;
  onRun: () => void;
  isLive: boolean;
  isPlaying: boolean;
  isTouch: boolean;
  isReduced: boolean;
  isToastVisible: boolean;
  onNavigate: (module: ModuleId) => void;
  onAnnounce: (message: string) => void;
}

/**
 * The app window: a spreadsheet file that becomes "Your Showroom · CRM".
 * The sheet sits under the admin; the admin's chrome and cards start
 * invisible and the morph engine brings them in. Every module is mounted
 * (so each keeps its state between chapters) and only the active one is
 * shown and focusable.
 */
export default function Window(props: WindowProps) {
  const t = useTranslations('home.crm-build');
  const { bodyRef, engineRef, slotsRef, board, dispatch, demo, module, role, onRole, runs, onRun } = props;
  const { isLive, isPlaying, isTouch, isReduced, isToastVisible, onNavigate, onAnnounce } = props;
  const locked = LOCKED_NAV[role];
  const person = rolePerson(demo, role);

  const navButton = (id: ModuleId | 'settings', variant: 'side' | 'tab') => {
    const Icon = MODULE_ICONS[id];
    const isLocked = locked.includes(id);
    const isCurrent = id === module;
    const label = variant === 'tab' && id !== 'settings' ? t(`app.navShort.${id}`) : t(`app.nav.${id}`);
    return (
      <button
        type='button'
        className={variant === 'side' ? css.navItem : css.tab}
        aria-current={isCurrent ? 'page' : undefined}
        aria-disabled={isLocked || id === 'settings' ? true : undefined}
        data-locked={isLocked ? '' : undefined}
        title={isLocked ? t('app.locked') : undefined}
        onClick={() => {
          if (!isLocked && id !== 'settings') onNavigate(id);
        }}
      >
        <Icon className={css.navIcon} />
        <span className={css.navLabel}>{label}</span>
        {isLocked && <LockIcon className={css.lock} />}
      </button>
    );
  };

  return (
    <div className={css.frame} data-frame role='region' aria-label={t('demoLabel')}>
      <div className={css.titlebar}>
        <span className={css.lights} aria-hidden='true'>
          <span />
          <span />
          <span />
        </span>
        <span className={css.titles}>
          <span className={css.titleText} data-title='sheet' aria-hidden={isLive ? true : undefined}>
            {demo.file}
          </span>
          <span className={css.titleText} data-title='app' aria-hidden={isLive ? undefined : true}>
            {t('app.business')} · {t('app.product')}
          </span>
        </span>
      </div>

      <div ref={bodyRef} className={css.body}>
        <Sheet demo={demo} />
        {!isLive && <p className={css.srOnly}>{t('sheet.label')}</p>}

        <div className={css.app} data-live={isLive ? '' : undefined} inert={!isLive}>
          <aside className={css.sidebar} data-chrome>
            <div className={css.brand}>
              <span className={css.brandMark} aria-hidden='true'>
                {t('app.businessMark')}
              </span>
              <span className={css.brandName}>{t('app.business')}</span>
            </div>
            <ul className={css.nav}>
              {MODULE_IDS.map(id => (
                <li key={id}>{navButton(id, 'side')}</li>
              ))}
            </ul>
            <div className={css.navFoot}>{navButton('settings', 'side')}</div>
          </aside>

          <div className={css.content}>
            <header className={css.topbar} data-chrome>
              <span className={css.topBrand}>
                <span className={css.brandMark} aria-hidden='true'>
                  {t('app.businessMark')}
                </span>
                <span className={css.brandName}>{t('app.business')}</span>
              </span>
              <span className={css.search} aria-hidden='true'>
                <SearchIcon className={css.searchIcon} />
                {t('app.search')}
              </span>
              <span className={css.bell} role='img' aria-label={t('app.notifications', { count: runs })}>
                <BellIcon className={css.bellIcon} />
                {runs > 0 && (
                  <span key={runs} className={css.badge} aria-hidden='true'>
                    {runs}
                  </span>
                )}
              </span>
              <span key={role} className={css.avatar} title={person.name} aria-hidden='true'>
                {person.initials}
              </span>
            </header>

            <div className={css.main}>
              <div className={css.module} data-active={module === 'pipeline' ? '' : undefined} inert={module !== 'pipeline'}>
                <Pipeline
                  board={board}
                  dispatch={dispatch}
                  demo={demo}
                  engineRef={engineRef}
                  slotsRef={slotsRef}
                  isLive={isLive}
                  isActive={module === 'pipeline'}
                  isPlaying={isPlaying}
                  isTouch={isTouch}
                  isReduced={isReduced}
                  onAnnounce={onAnnounce}
                />
              </div>
              <div className={css.module} data-active={module === 'roles' ? '' : undefined} inert={module !== 'roles'}>
                <Roles
                  board={board}
                  demo={demo}
                  role={role}
                  onRole={onRole}
                  isActive={module === 'roles' && isLive}
                  isPlaying={isPlaying}
                  isReduced={isReduced}
                />
              </div>
              <div className={css.module} data-active={module === 'automations' ? '' : undefined} inert={module !== 'automations'}>
                <Automations
                  demo={demo}
                  isActive={module === 'automations' && isLive}
                  isPlaying={isPlaying}
                  isReduced={isReduced}
                  onRun={onRun}
                />
              </div>
              <div className={css.module} data-active={module === 'reports' ? '' : undefined} inert={module !== 'reports'}>
                <Reports board={board} demo={demo} isActive={module === 'reports' && isLive} isReduced={isReduced} />
              </div>
              <div className={css.module} data-active={module === 'integrations' ? '' : undefined} inert={module !== 'integrations'}>
                <Integrations demo={demo} isActive={module === 'integrations' && isLive} isPlaying={isPlaying} isReduced={isReduced} />
              </div>
            </div>

            <nav className={css.tabbar} data-chrome aria-label={t('app.business')}>
              {MODULE_IDS.map(id => (
                <span key={id} className={css.tabSlot}>
                  {navButton(id, 'tab')}
                </span>
              ))}
            </nav>
          </div>

          <div className={css.toast} role='status' data-visible={isToastVisible ? '' : undefined}>
            <CheckIcon className={css.toastIcon} />
            {t('app.imported', IMPORTED)}
          </div>
        </div>
      </div>
    </div>
  );
}
