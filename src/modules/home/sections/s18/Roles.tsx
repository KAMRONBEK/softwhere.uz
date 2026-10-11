'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type CSSProperties } from 'react';
import { STAGE_IDS, getDeal, type Board } from './board';
import { DEALS, PERMISSIONS, ROLE_IDS, type DealId, type RoleId, type StageId } from './data';
import { rolePerson, type Demo } from './demo';
import { CheckIcon, CrossIcon, LockIcon } from './icons';
import css from './roles.module.css';

/** Autopilot: owner → sales → support → owner, once, unless the visitor picks a role. */
const AUTOPILOT: ReadonlyArray<{ role: RoleId; delay: number }> = [
  { role: 'sales', delay: 1300 },
  { role: 'support', delay: 2600 },
  { role: 'owner', delay: 2600 },
];
const SALES_PERSON = 'aziz';

interface RolesProps {
  board: Board;
  demo: Demo;
  role: RoleId;
  onRole: (role: RoleId) => void;
  isActive: boolean;
  isPlaying: boolean;
  isReduced: boolean;
}

function rowsFor(board: Board, role: RoleId): Array<{ id: DealId; stage: StageId }> {
  const all = STAGE_IDS.flatMap(stage => board[stage].map(id => ({ id, stage })));
  return role === 'sales' ? all.filter(row => getDeal(row.id).manager === SALES_PERSON) : all;
}

/**
 * Roles & permissions: the same deals seen as the owner (everything), a
 * sales manager (only his own deals, no export) and support (every client,
 * no amounts, read-only). Switching re-deals the list and flips the
 * permission ticks; the sidebar locks follow (Window).
 */
export default function Roles({ board, demo, role, onRole, isActive, isPlaying, isReduced }: RolesProps) {
  const t = useTranslations('home.crm-build');
  const { currency, clients, money } = demo;
  const [hasInteracted, setHasInteracted] = useState(false);
  const [autoStep, setAutoStep] = useState(0);

  const isAutopilotOn = isActive && isPlaying && !hasInteracted && !isReduced;
  useEffect(() => {
    if (!isAutopilotOn || autoStep >= AUTOPILOT.length) return;
    const step = AUTOPILOT[autoStep];
    const id = window.setTimeout(() => {
      onRole(step.role);
      setAutoStep(n => n + 1);
    }, step.delay);
    return () => window.clearTimeout(id);
  }, [isAutopilotOn, autoStep, onRole]);

  const pick = (next: RoleId) => {
    setHasInteracted(true);
    onRole(next);
  };

  const index = Math.max(0, ROLE_IDS.indexOf(role));
  const rows = rowsFor(board, role);
  const canExport = role === 'owner';
  const isReadOnly = role === 'support';

  return (
    <div className={css.roles}>
      <div className={css.switchRow}>
        <span className={css.viewingAs} id='crm-viewing-as'>
          {t('roles.viewingAs')}
        </span>
        <div className={css.segmented} role='group' aria-labelledby='crm-viewing-as' style={{ '--i': index } as CSSProperties}>
          <span className={css.thumb} aria-hidden='true' />
          {ROLE_IDS.map(item => {
            const person = rolePerson(demo, item);
            return (
              <button
                key={item}
                type='button'
                className={css.segment}
                aria-pressed={item === role}
                onClick={() => pick(item)}
                title={t('roles.switchLabel')}
              >
                <span className={css.segmentAvatar} aria-hidden='true'>
                  {person.initials}
                </span>
                <span className={css.segmentText}>
                  <span className={css.segmentName}>{t(`roles.${item}.name`)}</span>
                  <span className={css.segmentPerson}>{person.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={css.layout}>
        <div className={css.panel}>
          <div className={css.panelHead}>
            <span className={css.panelTitle}>
              {t(`roles.${role}.view`)}
              <span className={css.panelCount}>{rows.length}</span>
            </span>
            {isReadOnly && <span className={css.chip}>{t('roles.readOnly')}</span>}
            <span className={css.export} data-locked={canExport ? undefined : ''}>
              {!canExport && <LockIcon className={css.exportIcon} />}
              {t('roles.export')}
            </span>
          </div>

          <ul key={role} className={css.rows} data-animate={isReduced ? undefined : ''}>
            {rows.map((row, rowIndex) => {
              const deal = getDeal(row.id);
              const stageLabel = role === 'support' ? t(`roles.supportStage.${row.stage}`) : t(`stages.${row.stage}`);
              return (
                <li key={row.id} className={css.row} style={{ '--n': rowIndex } as CSSProperties}>
                  <span className={css.who}>
                    <span className={css.client}>{clients[deal.id]}</span>
                    <span className={css.item}>{t(`deals.${deal.id}`)}</span>
                  </span>
                  <span className={css.stage} data-stage={row.stage}>
                    {stageLabel}
                  </span>
                  {role === 'support' ? (
                    <span className={css.masked} aria-label={t('roles.hidden')}>
                      <LockIcon className={css.maskIcon} />
                      •••
                    </span>
                  ) : (
                    <span className={css.amount}>{money.short(deal.amount[currency])}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className={css.panelFoot}>
            {t(`roles.scope.${role}`, { shown: rows.length, total: DEALS.length, person: rolePerson(demo, role).name })}
          </p>
        </div>

        <ul className={css.perms} aria-label={t('roles.permissions')}>
          {PERMISSIONS.map(permission => {
            const access = permission.by[role];
            return (
              <li key={permission.id} className={css.perm} data-access={access}>
                <span className={css.permIcon} aria-hidden='true'>
                  {access === 'no' ? <CrossIcon /> : <CheckIcon />}
                </span>
                <span className={css.permName}>{t(`roles.permission.${permission.id}`)}</span>
                <span className={css.permValue}>{t(`roles.access.${access}`)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
