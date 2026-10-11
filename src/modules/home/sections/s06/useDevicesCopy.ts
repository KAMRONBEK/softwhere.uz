import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useProjectDescriber } from '../../media/useProjectDescriber';
import { useShowcaseCopy } from '../../media/useShowcaseCopy';
import { DEVICE_APPS, DEVICES_FACTS, LAPTOP_APP_ID, STORE_MARKETS } from './data';

/** One phone app's card, in the visitor's language. */
export interface DevicesAppCopy {
  /** What the app is ("Messenger app"), never its name. */
  title: string;
  /** Short rail label ("Investing"). */
  tag: string;
  /** Field and market ("Messaging · Uzbekistan"); the field is left out when the title already says it. */
  kicker: string;
  oneLiner: string;
  /** Platform chips ("Web" / "Веб" / "Veb"). */
  platforms: string[];
  /** One caption per screen, in screen order. */
  captions: string[];
}

export interface DevicesCopy {
  heading: string;
  intro: string;
  stageLabel: string;
  outroTitle: string;
  outroText: string;
  /** Screen-reader prefix of app `index` (0-based): "1 of 3:". */
  position: (index: number) => string;
  /** Parallel to DEVICE_APPS. */
  apps: DevicesAppCopy[];
}

/** "an auction marketplace" → "Auction marketplace" (en drops its article; ru/uz have none). */
function titleOf(descriptor: string): string {
  const kind = descriptor.replace(/^an? /, '');
  return `${kind[0]?.toUpperCase() ?? ''}${kind.slice(1)}`;
}

/**
 * Every visitor-facing word of 06 · Devices: section copy from
 * `home.devices`, screen captions and app descriptors from
 * `home.shared.showcase`, field, market and platform names from the project
 * describer. The renderers (WebGL and CSS) only need data/DEVICE_APPS.
 */
export function useDevicesCopy(): DevicesCopy {
  const t = useTranslations('home.devices');
  const describer = useProjectDescriber();
  const showcase = useShowcaseCopy();

  return useMemo(() => {
    const laptopKind = showcase.descriptor(LAPTOP_APP_ID);
    // Joined by the messages, not Intl.ListFormat: browsers without Uzbek list data print "and".
    const names = STORE_MARKETS.map(market => describer.location(market));
    const markets =
      names.length > 1 ? t('listJoin', { rest: names.slice(0, -1).join(', '), last: names[names.length - 1] }) : (names[0] ?? '');
    const apps = DEVICE_APPS.map(app => {
      const title = app.project ? describer.title(app.project) : titleOf(showcase.descriptor(app.id));
      const location = describer.location(app.field);
      return {
        title,
        tag: t(`apps.${app.id}.tag`),
        kicker: app.isFieldInTitle ? location : `${describer.industry(app.field)} · ${location}`,
        oneLiner: t(`apps.${app.id}.oneLiner`),
        platforms: app.platforms.map(platform => describer.platform(platform)),
        captions: app.screens.map(screen => showcase.caption({ id: app.id }, screen.shot)),
      };
    });
    return {
      heading: t('heading'),
      intro: t('intro', { laptopKind, phoneApps: DEVICES_FACTS.phoneApps }),
      stageLabel: t('stageLabel', { laptopKind, phoneApps: DEVICES_FACTS.phoneApps }),
      outroTitle: t('outroTitle'),
      outroText: t('outroText', { liveApps: DEVICES_FACTS.liveApps, markets }),
      position: index => t('appPosition', { index: index + 1, total: DEVICE_APPS.length }),
      apps,
    };
  }, [t, describer, showcase]);
}
