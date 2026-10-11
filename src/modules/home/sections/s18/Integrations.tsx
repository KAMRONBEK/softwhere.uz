'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatClock, type Connector, type ConnectorId, type Demo } from './demo';
import { ALERT_ICONS, CONNECTOR_ICONS } from './icons';
import css from './integrations.module.css';

const CONNECT_EVERY_MS = 520;
const FIRST_CONNECT_MS = 600;
/** Once tools are on, their data keeps arriving. */
const STREAM_EVERY_MS = 1500;
const FEED_LENGTH = 14;
/** The feed's clock: the first event lands at 9:20, the next a minute or two later. */
const FIRST_EVENT_AT = 9 * 60 + 20;
const EVENT_GAPS_MIN = [1, 2, 1, 3, 2];

interface IntegrationsProps {
  demo: Demo;
  isActive: boolean;
  isPlaying: boolean;
  isReduced: boolean;
}

interface FeedEntry {
  id: number;
  connector: ConnectorId;
  at: number;
  text: string;
}

interface FeedState {
  entries: readonly FeedEntry[];
  /** Events posted so far (the next id) and the clock's last time. */
  count: number;
  at: number;
  /** Where the stream continues in streamOrder(). */
  cursor: number;
}

const EMPTY_FEED: FeedState = { entries: [], count: 0, at: FIRST_EVENT_AT, cursor: 0 };

/** Every tool's follow-up events, then their first ones again: the order the stream walks. */
function streamOrder(connectors: readonly Connector[]): ReadonlyArray<{ connector: ConnectorId; text: string }> {
  const rounds = Math.max(...connectors.map(c => c.events.length));
  return Array.from({ length: rounds }, (_, round) => (round + 1) % rounds).flatMap(round =>
    connectors.flatMap(c => (c.events[round] ? [{ connector: c.id, text: c.events[round] }] : []))
  );
}

function post(feed: FeedState, connector: ConnectorId, text: string): FeedState {
  const at = feed.count === 0 ? feed.at : feed.at + EVENT_GAPS_MIN[feed.count % EVENT_GAPS_MIN.length];
  const entry: FeedEntry = { id: feed.count + 1, connector, at, text };
  return { ...feed, entries: [entry, ...feed.entries].slice(0, FEED_LENGTH), count: feed.count + 1, at };
}

/**
 * Integrations: the CRM in the middle, six tools around it on a bus. Each
 * one switches on (its line lights, data starts to run along it) and posts
 * what it just did to the activity feed, which keeps streaming from the tools
 * that are on. They connect one by one the first time the module shows; tap
 * any tile to switch it off (its events stop) or on.
 */
export default function Integrations({ demo, isActive, isPlaying, isReduced }: IntegrationsProps) {
  const t = useTranslations('home.crm-build');
  const { connectors } = demo;
  const order = useMemo(() => streamOrder(connectors), [connectors]);
  const [connectedState, setConnected] = useState<ReadonlySet<ConnectorId>>(() => new Set());
  const [feedState, setFeed] = useState<FeedState>(EMPTY_FEED);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Reduced motion opens with everything connected and a still feed (nothing streams by itself).
  const isStill = isReduced && !hasInteracted;
  const connected = useMemo<ReadonlySet<ConnectorId>>(
    () => (isStill ? new Set(connectors.map(c => c.id)) : connectedState),
    [isStill, connectors, connectedState]
  );
  const feed = useMemo<FeedState>(
    () =>
      isStill ? order.slice(0, FEED_LENGTH).reduce((state, event) => post(state, event.connector, event.text), EMPTY_FEED) : feedState,
    [isStill, order, feedState]
  );

  const nextOff = connectors.find(c => !connected.has(c.id));
  const isAutopilotOn = isActive && isPlaying && !hasInteracted && !isReduced && Boolean(nextOff);
  useEffect(() => {
    if (!isAutopilotOn || !nextOff) return;
    const id = window.setTimeout(
      () => {
        setConnected(prev => new Set([...prev, nextOff.id]));
        setFeed(prev => post(prev, nextOff.id, nextOff.events[0]));
      },
      connected.size === 0 ? FIRST_CONNECT_MS : CONNECT_EVERY_MS
    );
    return () => window.clearTimeout(id);
  }, [isAutopilotOn, nextOff, connected.size]);

  // The stream: the next event from a tool that is on, every STREAM_EVERY_MS.
  const isStreaming = isActive && isPlaying && !isReduced && !isAutopilotOn && connected.size > 0;
  useEffect(() => {
    if (!isStreaming) return;
    const id = window.setInterval(() => {
      setFeed(prev => {
        for (let step = 0; step < order.length; step++) {
          const index = (prev.cursor + step) % order.length;
          const event = order[index];
          if (connectedState.has(event.connector)) return { ...post(prev, event.connector, event.text), cursor: index + 1 };
        }
        return prev;
      });
    }, STREAM_EVERY_MS);
    return () => window.clearInterval(id);
  }, [isStreaming, order, connectedState]);

  const toggle = (id: ConnectorId) => {
    const connector = connectors.find(c => c.id === id);
    if (!connector) return;
    setHasInteracted(true);
    const isOn = connected.has(id);
    const next = new Set(connected);
    if (isOn) next.delete(id);
    else next.add(id);
    setConnected(next);
    setFeed(isOn ? feed : post(feed, id, connector.events[0]));
  };

  const iconFor = (connector: Connector): ReactNode => {
    if (connector.monogram) return <span className={css.monogram}>{connector.monogram}</span>;
    const Icon = connector.id === 'messenger' ? ALERT_ICONS[demo.alert.channel] : CONNECTOR_ICONS[connector.id];
    return <Icon />;
  };

  const top = connectors.slice(0, 3);
  const bottom = connectors.slice(3);
  const isBusLive = connected.size > 0;

  const renderTile = (connector: Connector) => {
    const isOn = connected.has(connector.id);
    return (
      <li key={connector.id} className={css.slot} data-on={isOn ? '' : undefined}>
        <button
          type='button'
          className={css.tile}
          aria-pressed={isOn}
          aria-label={isOn ? t('integrations.disconnect', { name: connector.name }) : t('integrations.connect', { name: connector.name })}
          onClick={() => toggle(connector.id)}
        >
          <span className={css.tileIcon} aria-hidden='true'>
            {iconFor(connector)}
          </span>
          <span className={css.tileText}>
            <span className={css.tileName}>{connector.name}</span>
            <span className={css.tileRole}>{connector.role}</span>
          </span>
          <span className={css.switch} aria-hidden='true' />
        </button>
      </li>
    );
  };

  return (
    <div className={css.integrations}>
      <div className={css.head}>
        <span className={css.title}>{t('integrations.title')}</span>
        <span className={css.count}>{t('integrations.count', { on: connected.size, total: connectors.length })}</span>
      </div>

      <div className={css.hubArea}>
        <ul className={css.row}>{top.map(renderTile)}</ul>
        <div className={css.bus} data-live={isBusLive ? '' : undefined}>
          <span className={css.busLine} aria-hidden='true' />
          {connectors.map((connector, index) => (
            <span
              key={connector.id}
              className={css.stem}
              data-side={index < 3 ? 'top' : 'bottom'}
              data-col={index % 3}
              data-on={connected.has(connector.id) ? '' : undefined}
              aria-hidden='true'
            >
              <span className={css.packet} />
            </span>
          ))}
          <span className={css.hub}>
            <span className={css.hubMark} aria-hidden='true'>
              {t('app.businessMark')}
            </span>
            <span className={css.hubName}>{t('integrations.hub')}</span>
          </span>
        </div>
        <ul className={css.row}>{bottom.map(renderTile)}</ul>
      </div>

      <div className={css.feed}>
        <span className={css.feedHead}>
          <span className={css.feedTitle}>{t('integrations.activity')}</span>
          {isStreaming && <span className={css.liveDot}>{t('integrations.live')}</span>}
        </span>
        <ol className={css.feedList}>
          {feed.entries.length === 0 ? (
            <li className={css.feedIdle}>{t('integrations.idle')}</li>
          ) : (
            feed.entries.map(entry => {
              const connector = connectors.find(c => c.id === entry.connector);
              return (
                <li key={entry.id} className={css.feedRow}>
                  <span className={css.feedTime}>{formatClock(entry.at, demo.currency)}</span>
                  <span className={css.feedSource} aria-hidden='true'>
                    {connector && iconFor(connector)}
                  </span>
                  <span className={css.feedText}>{entry.text}</span>
                </li>
              );
            })
          )}
        </ol>
      </div>
      <p className={css.note}>{t('integrations.note')}</p>
    </div>
  );
}
