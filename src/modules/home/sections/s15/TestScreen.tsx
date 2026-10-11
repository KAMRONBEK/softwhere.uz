'use client';

import { memo, type CSSProperties } from 'react';
import { TEST_DEVICES } from './data';
import { useAppTheme } from './context';
import { CheckIcon } from './icons';
import layer from './layers.module.css';
import MiniApp from './MiniApp';
import { useCopy } from './useCopy';
import css from './test.module.css';

function at(index: number): CSSProperties {
  return { ['--i' as string]: index };
}

/**
 * Step 5 · Test on real devices: the beta build's dashboard. Six devices
 * (small and large, iOS and Android, a tablet, a slow network) report in one
 * by one, the crash-free ring fills, and the build is ready for the stores.
 * Every check is a CSS animation that starts when the screen comes on; the
 * still version shows the finished dashboard.
 */
function TestScreen() {
  const { theme } = useAppTheme();
  const { test } = useCopy();
  return (
    <div className={css.test}>
      <div className={`${css.head} ${layer.block}`} style={at(0)}>
        <span className={css.build}>{test.build}</span>
        <strong className={css.title}>{test.title}</strong>
      </div>

      <div className={`${css.health} ${layer.block}`} style={at(1)}>
        <svg className={css.ring} viewBox='0 0 44 44' aria-hidden='true' focusable='false'>
          <circle className={css.ringTrack} cx='22' cy='22' r='18' pathLength='100' />
          <circle className={css.ringFill} cx='22' cy='22' r='18' pathLength='100' />
        </svg>
        <span className={css.healthText}>
          <strong className={css.value}>{test.crashValue}</strong>
          <span className={css.label}>{test.crashFree}</span>
          <span className={css.passed}>
            <CheckIcon className={css.passedIcon} />
            {test.passed}
          </span>
        </span>
      </div>

      <ul className={css.grid}>
        {TEST_DEVICES.map((device, index) => (
          <li key={device.id} className={`${css.tile} ${layer.block}`} style={at(2 + index)}>
            <span className={css.device} data-shape={device.shape}>
              <span className={css.deviceScreen}>
                <MiniApp theme={theme} />
              </span>
            </span>
            <span className={css.tileText}>
              <span className={css.tileLabel}>{test.device(device.id)}</span>
              <span className={css.status} style={at(index)}>
                <span className={css.spin} aria-hidden='true' />
                <CheckIcon className={css.ok} />
              </span>
            </span>
          </li>
        ))}
      </ul>

      <span className={css.ready}>
        <CheckIcon className={css.readyIcon} />
        {test.ready}
      </span>
    </div>
  );
}

export default memo(TestScreen);
