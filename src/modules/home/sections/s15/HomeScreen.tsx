'use client';

import { memo, type CSSProperties, type ReactNode } from 'react';
import { CATEGORY_IDS, DISHES, TRACK_STEP_IDS } from './data';
import { useAppTheme, useBuild, useDemoEnv } from './context';
import {
  BagIcon,
  BikeIcon,
  ChevronDownIcon,
  DishArt,
  HomeIcon,
  MoonIcon,
  PhoneCallIcon,
  PinIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  SunIcon,
  UserIcon,
} from './icons';
import css from './home.module.css';
import layer from './layers.module.css';
import { useCopy } from './useCopy';

type Variant = 'wire' | 'real';

/** Stagger index for the layer cascade (screens.module.css `.block`). */
function at(index: number): CSSProperties {
  return { ['--i' as string]: index };
}

/** Text in the real app; a gray bar of about the same width in the wireframe. */
function Text({ variant, width, children }: { variant: Variant; width: number; children: ReactNode }) {
  if (variant === 'wire') return <span className={css.bar} style={{ ['--w' as string]: `${width}em` }} />;
  return <>{children}</>;
}

/** An icon in the real app; a hollow circle in the wireframe. */
function Glyph({ variant, children }: { variant: Variant; children: ReactNode }) {
  return variant === 'wire' ? <span className={css.dot} /> : <>{children}</>;
}

/** The touch ripple the autopilot leaves on what it "taps". */
function Ghost({ id }: { id: string }) {
  const { ghost, beat, adds } = useBuild();
  if (ghost !== id) return null;
  return <span className={css.touch} key={`${beat}-${adds}`} aria-hidden='true' />;
}

function ThemeToggle() {
  const { theme } = useAppTheme();
  const { dispatch } = useDemoEnv();
  const { app, cursor } = useCopy();
  const isDark = theme === 'dark';
  return (
    <button
      type='button'
      className={css.toggle}
      role='switch'
      aria-checked={isDark}
      aria-label={app.themeToggle(isDark)}
      onClick={() => dispatch({ type: 'THEME', theme: isDark ? 'light' : 'dark', isUser: true })}
      data-cursor={isDark ? cursor.light : cursor.dark}
      data-cursor-icon='none'
    >
      <SunIcon className={css.toggleSun} />
      <MoonIcon className={css.toggleMoon} />
      <span className={css.toggleKnob} />
    </button>
  );
}

function CartButton() {
  const { cart, adds } = useBuild();
  const { dispatch, isStatic } = useDemoEnv();
  const { app, cursor } = useCopy();
  return (
    <button
      type='button'
      className={css.cart}
      aria-label={app.cart(cart)}
      onClick={() => dispatch({ type: 'ORDER', isUser: true, isStatic })}
      data-cursor={cart > 0 ? cursor.order : undefined}
      data-cursor-icon='none'
    >
      <BagIcon className={css.icon} />
      {cart > 0 && (
        <span className={css.badge} key={adds}>
          {cart}
        </span>
      )}
      <Ghost id='cart' />
    </button>
  );
}

function Header({ variant }: { variant: Variant }) {
  const { app } = useCopy();
  return (
    <header className={`${css.header} ${layer.block}`} style={at(0)}>
      <div className={css.where}>
        <span className={css.whereLabel}>
          <Text variant={variant} width={4.6}>
            {app.deliverTo}
          </Text>
        </span>
        <span className={css.whereValue}>
          <Glyph variant={variant}>
            <PinIcon className={css.pin} />
          </Glyph>
          <Text variant={variant} width={3.4}>
            {app.address}
          </Text>
          {variant === 'real' && <ChevronDownIcon className={css.chev} />}
        </span>
      </div>
      {variant === 'real' ? (
        <>
          <ThemeToggle />
          <CartButton />
        </>
      ) : (
        <>
          <span className={`${css.toggle} ${css.wireBox}`} />
          <span className={`${css.cart} ${css.wireBox}`} />
        </>
      )}
    </header>
  );
}

function Promo({ variant }: { variant: Variant }) {
  const { app } = useCopy();
  return (
    <div className={`${css.promo} ${layer.block}`} style={at(2)}>
      <div className={css.promoText}>
        <strong>
          <Text variant={variant} width={6.4}>
            {app.promoTitle}
          </Text>
        </strong>
        <span>
          <Text variant={variant} width={7.2}>
            {app.promoText}
          </Text>
        </span>
      </div>
      <span className={css.promoArt}>{variant === 'real' ? <DishArt kind='pizza' /> : <span className={css.placeholder} />}</span>
    </div>
  );
}

function Categories({ variant }: { variant: Variant }) {
  const copy = useCopy();
  return (
    <ul className={`${css.cats} ${layer.block}`} style={at(3)}>
      {CATEGORY_IDS.map(id => (
        <li key={id} className={css.cat}>
          <span className={css.catArt}>{variant === 'real' ? <DishArt kind={id} /> : <span className={css.placeholder} />}</span>
          <span className={css.catName}>
            <Text variant={variant} width={2.8}>
              {copy.category(id)}
            </Text>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Grid({ variant }: { variant: Variant }) {
  const { dispatch, currency } = useDemoEnv();
  const copy = useCopy();
  return (
    <ul className={css.grid}>
      {DISHES.map((dish, index) => (
        <li key={dish.id} className={`${css.card} ${layer.block}`} style={at(5 + index)}>
          <span className={css.cardArt}>{variant === 'real' ? <DishArt kind={dish.art} /> : <span className={css.placeholder} />}</span>
          <span className={css.cardName}>
            <Text variant={variant} width={6.2}>
              {copy.dish(dish.id).name}
            </Text>
          </span>
          <span className={css.cardShop}>
            <Text variant={variant} width={4.6}>
              {copy.dish(dish.id).shop}
            </Text>
          </span>
          <span className={css.cardPrice} data-currency={currency}>
            <Text variant={variant} width={3.2}>
              {copy.price(dish.price[currency])}
            </Text>
          </span>
          {variant === 'real' ? (
            <button
              type='button'
              className={css.add}
              aria-label={copy.app.add(copy.dish(dish.id).name)}
              onClick={() => dispatch({ type: 'ADD', dish: dish.id, isUser: true })}
              data-cursor={copy.cursor.add}
              data-cursor-icon='none'
            >
              <PlusIcon className={css.icon} />
              <Ghost id={`add-${dish.id}`} />
            </button>
          ) : (
            <span className={`${css.add} ${css.wireBox}`} data-flow-add={index === 0 ? '' : undefined} />
          )}
        </li>
      ))}
    </ul>
  );
}

const TAB_ITEMS = [
  { id: 'home', Icon: HomeIcon, tab: 'home' },
  { id: 'search', Icon: SearchIcon, tab: null },
  { id: 'orders', Icon: ReceiptIcon, tab: 'track' },
  { id: 'profile', Icon: UserIcon, tab: null },
] as const;

function TabContent({ variant, item }: { variant: Variant; item: (typeof TAB_ITEMS)[number] }) {
  const { app } = useCopy();
  return (
    <>
      <span className={css.tabIcon}>
        <Glyph variant={variant}>
          <item.Icon className={css.icon} />
        </Glyph>
      </span>
      <span className={css.tabLabel}>
        <Text variant={variant} width={2.4}>
          {app.tab(item.id)}
        </Text>
      </span>
    </>
  );
}

/** The wireframe's tab bar: boxes and bars, nothing tappable. */
function WireTabs() {
  return (
    <nav className={`${css.tabs} ${layer.block}`} style={at(9)}>
      {TAB_ITEMS.map(item => (
        <span key={item.id} className={css.tab}>
          <TabContent variant='wire' item={item} />
        </span>
      ))}
    </nav>
  );
}

function Tabs() {
  const { tab: current } = useBuild();
  const { dispatch } = useDemoEnv();
  const { app } = useCopy();
  return (
    <nav className={`${css.tabs} ${layer.block}`} style={at(9)} aria-label={app.tabsLabel}>
      {TAB_ITEMS.map(item => {
        if (!item.tab) {
          return (
            <span key={item.id} className={css.tab}>
              <TabContent variant='real' item={item} />
            </span>
          );
        }
        const tab = item.tab;
        return (
          <button
            key={item.id}
            type='button'
            className={css.tab}
            aria-current={tab === current ? 'page' : undefined}
            onClick={() => dispatch({ type: 'TAB', tab, isUser: true })}
          >
            <TabContent variant='real' item={item} />
            <Ghost id={`tab-${tab}`} />
          </button>
        );
      })}
    </nav>
  );
}

/** The order the autopilot places: the first two dishes. */
const PLACED_ORDER = DISHES.slice(0, 2);

/** The courier's live map and the order's progress (the Orders tab). */
function TrackView() {
  const { tab, beat } = useBuild();
  const { currency } = useDemoEnv();
  const copy = useCopy();
  const { app } = copy;
  const isOpen = tab === 'track';
  const total = PLACED_ORDER.reduce((sum, dish) => sum + dish.price[currency], 0);
  return (
    <div className={css.track} data-open={isOpen ? 'true' : undefined} aria-hidden={!isOpen} inert={!isOpen}>
      <div className={css.trackHead}>
        <strong>{app.trackTitle}</strong>
        <span>{app.trackEta}</span>
      </div>
      <div className={css.map}>
        <svg className={css.mapArt} viewBox='0 0 100 100' preserveAspectRatio='none' aria-hidden='true' focusable='false'>
          <rect className={css.park} x='66' y='4' width='28' height='14' rx='3' />
          <rect className={css.park} x='6' y='70' width='22' height='24' rx='3' />
          <rect className={css.water} x='34' y='80' width='60' height='16' rx='3' />
          <path className={css.street} d='M0 22H100M0 46H100M0 64H100M18 0V100M42 0V100M62 0V100M82 0V100' />
          <path className={css.streetMinor} d='M0 34H100M0 10H100M30 0V100M72 0V100' />
          <path className={css.routeBed} d='M18 22H62V64H82' />
          <path className={css.route} d='M18 22H62V64H82' />
        </svg>
        <span className={css.shop}>
          <BagIcon className={css.icon} />
        </span>
        <span className={css.destination} key={isOpen ? `on-${beat}` : 'off'}>
          <PinIcon className={css.icon} />
        </span>
        {isOpen && (
          <span className={css.courierPath} key={beat}>
            <span className={css.courier}>
              <BikeIcon className={css.icon} />
            </span>
          </span>
        )}
      </div>
      <div className={css.sheet}>
        <ol className={css.progress}>
          {TRACK_STEP_IDS.map((id, index) => (
            <li key={id} data-state={index < 2 ? 'done' : index === 2 ? 'now' : undefined}>
              <span className={css.progressDot} />
              <span className={css.progressLabel}>{app.trackStep(id)}</span>
            </li>
          ))}
        </ol>
        <div className={css.courierRow}>
          <span className={css.avatar}>
            <BikeIcon className={css.icon} />
          </span>
          <span className={css.courierText}>
            <strong>{app.courier}</strong>
            <span>{app.courierRole}</span>
          </span>
          <span className={css.call}>
            <PhoneCallIcon className={css.icon} />
          </span>
        </div>
        <div className={css.orderRow}>
          <span className={css.orderText}>
            <strong>{app.orderLabel}</strong>
            <span>{PLACED_ORDER.map(dish => copy.dish(dish.id).name).join(', ')}</span>
          </span>
          <strong className={css.orderTotal}>{copy.price(total)}</strong>
        </div>
      </div>
    </div>
  );
}

function Push() {
  const { isPush } = useBuild();
  const { dispatch } = useDemoEnv();
  const { app, cursor } = useCopy();
  return (
    <button
      type='button'
      className={css.push}
      data-show={isPush ? 'true' : undefined}
      aria-hidden={!isPush}
      tabIndex={isPush ? 0 : -1}
      aria-label={`${app.pushText} ${app.pushOpen}`}
      onClick={() => dispatch({ type: 'TAB', tab: 'track', isUser: true })}
      data-cursor={cursor.open}
      data-cursor-icon='open'
    >
      <span className={css.pushIcon}>
        <BagIcon className={css.icon} />
      </span>
      <span className={css.pushBody}>
        <span className={css.pushTop}>
          <strong>{app.name}</strong>
          <span>{app.pushWhen}</span>
        </span>
        <span className={css.pushText}>{app.pushText}</span>
      </span>
      <Ghost id='push' />
    </button>
  );
}

function Toast() {
  const { isToast } = useBuild();
  const { app } = useCopy();
  return (
    <p className={css.toast} data-show={isToast ? 'true' : undefined} role='status' aria-hidden={!isToast}>
      {app.toast}
    </p>
  );
}

/** Everything above the tab bar; no state of its own (the live controls read theirs). */
const HomeBody = memo(function HomeBody({ variant }: { variant: Variant }) {
  const { app } = useCopy();
  return (
    <>
      <Header variant={variant} />
      <div className={`${css.search} ${layer.block}`} style={at(1)}>
        <Glyph variant={variant}>
          <SearchIcon className={css.searchIcon} />
        </Glyph>
        <Text variant={variant} width={9}>
          {app.search}
        </Text>
      </div>
      <Promo variant={variant} />
      <Categories variant={variant} />
      <div className={`${css.rowTitle} ${layer.block}`} style={at(4)}>
        <strong>
          <Text variant={variant} width={7}>
            {app.popular}
          </Text>
        </strong>
        <span>
          <Text variant={variant} width={2.6}>
            {app.seeAll}
          </Text>
        </span>
      </div>
      <Grid variant={variant} />
    </>
  );
});

const TrackLayer = memo(TrackView);
const TabsLayer = memo(Tabs);

/**
 * The designed, working app's home screen: theme switch, cart, add buttons,
 * tabs, the courier map and a push notification. Reads only the theme wipe
 * and the open tab; the parts that change on a beat read their own slice.
 */
export const RealHome = memo(function RealHome() {
  const { themeFrom, themeFlips } = useAppTheme();
  const { tab } = useBuild();
  return (
    <div className={css.home} data-variant='real'>
      <span className={`${css.base} ${css.palette}`} data-theme={themeFrom} aria-hidden='true' />
      {themeFlips > 0 && <span className={css.wipe} key={themeFlips} aria-hidden='true' />}
      <div className={css.content} data-away={tab === 'track' ? 'true' : undefined}>
        <HomeBody variant='real' />
      </div>
      <TrackLayer />
      <TabsLayer />
      <Toast />
      <Push />
    </div>
  );
});

/** The same home screen as a wireframe: gray bars, crossed boxes, nothing tappable, no state. */
export const WireHome = memo(function WireHome() {
  return (
    <div className={css.home} data-variant='wire'>
      <div className={css.content}>
        <HomeBody variant='wire' />
      </div>
      <WireTabs />
    </div>
  );
});
