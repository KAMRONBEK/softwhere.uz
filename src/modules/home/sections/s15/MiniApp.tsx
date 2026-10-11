import type { AppTheme } from './state';
import home from './home.module.css';
import css from './mini.module.css';

interface MiniAppProps {
  theme: AppTheme;
  view?: 'home' | 'track';
  className?: string;
}

/**
 * A thumbnail of the demo app (blocks only, no text), for the device-lab
 * tiles, the store screenshots and the desktop satellites. It fills its box;
 * the box sets the aspect ratio.
 */
export default function MiniApp({ theme, view = 'home', className }: MiniAppProps) {
  return (
    <span className={`${css.mini} ${home.palette} ${className ?? ''}`} data-theme={theme} data-view={view} aria-hidden='true'>
      {view === 'home' ? (
        <>
          <span className={css.header} />
          <span className={css.headerDot} />
          <span className={css.search} />
          <span className={css.promo} />
          <span className={css.cats}>
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className={css.cards}>
            <i />
            <i />
          </span>
        </>
      ) : (
        <>
          <span className={css.map}>
            <i className={css.route} />
            <i className={css.routeDown} />
            <i className={css.pin} />
          </span>
          <span className={css.sheet} />
          <span className={css.sheetRow} />
        </>
      )}
      <span className={css.tabs} />
    </span>
  );
}
