import type { StaticImageData } from 'next/image';
import type { Messages } from 'next-intl';
import driveMeShotSmall from '../../assets/xray/driveme-960.webp';
import driveMeShot from '../../assets/xray/driveme.webp';
import talimShotSmall from '../../assets/xray/talim-ai-960.webp';
import talimShot from '../../assets/xray/talim-ai.webp';
import tesChatShotSmall from '../../assets/xray/tes-chat-960.webp';
import tesChatShot from '../../assets/xray/tes-chat.webp';
import { getProjectBySlug, type LabProject } from '../../media/portfolio';

/**
 * The three screens under the lens. Each shot is a real frame from the
 * project's walkthrough video (public/videos/<slug>.mp4), cut out along the
 * device outlines (transparent around them) so the devices sit on the page in
 * every style, upscaled 1.5× with a light sharpen and committed as WebP
 * (see ../../assets/xray).
 *
 * Geometry is authored in the logical 1200×800 space of the original frame
 * (the WebP is 1800×1200):
 * - `bodies` are the device outlines the cut-out follows (outer corners TL,
 *   TR, BR, BL + corner radius); they drive the placement and the shadow.
 * - `quad` is a device screen's corners; tilted phones are real quads, so
 *   outlines follow the perspective.
 * - `box` is [u0, v0, u1, v1] inside that screen (0..1, may overshoot for
 *   floating cards), mapped through the quad bilinearly.
 * - code cards anchor at a screen-space point and rotate with the screen.
 *
 * The screens are real; the outlines, component names and code are a
 * simplified sketch of each project's real stack (portfolio data), which the
 * section says plainly.
 */

export type Point = readonly [number, number];
export type Quad = readonly [Point, Point, Point, Point];
export type Box = readonly [number, number, number, number];
/** [x0, y0, x1, y1] in logical image px. */
export type Rect = readonly [number, number, number, number];

/** X-Ray copy keys: src/messages/home/xray/en.json (`parts`, `screens`, `captions`). */
type XRayMessages = Messages['home']['xray'];
export type XRayPartKey = keyof XRayMessages['parts'];
export type XRayScreenKey = keyof XRayMessages['screens'];
export type XRayCaptionKey = keyof XRayMessages['captions'];

export interface XRayPart {
  id: string;
  /** Plain-language name for the readout (localized from `copy`). */
  label: string;
  tag: string;
  note: string;
  box: Box;
  shape?: 'rect' | 'circle';
  /** Horizontal padding as a fraction of the box width, drawn hatched like DevTools. */
  pad?: number;
}

export interface XRayCode {
  file: string;
  /** What the snippet does, in plain words (drawn above the card; localized from `copy`). */
  caption: string;
  at: Point;
  lines: readonly string[];
}

export interface XRayScreen {
  name: string;
  label: string;
  /** "393 pt wide", localized: the readout when the lens is over the screen but no part. */
  widthLabel: string;
  quad: Quad;
  /** Logical width of the screen, for the measurement labels. */
  unitWidth: number;
  unit: 'dp' | 'pt' | 'px';
  parts: readonly XRayPart[];
  code: readonly XRayCode[];
}

type XRayPartDef = Omit<XRayPart, 'label'> & { copy: XRayPartKey };
type XRayCodeDef = Omit<XRayCode, 'caption'> & { copy: XRayCaptionKey };
type XRayScreenDef = Omit<XRayScreen, 'label' | 'widthLabel' | 'parts' | 'code'> & {
  copy: XRayScreenKey;
  parts: readonly XRayPartDef[];
  code: readonly XRayCodeDef[];
};

export interface XRayBody {
  quad: Quad;
  radius: number;
}

/** An autopilot stop: a code card or a part, by screen. */
export interface XRayStop {
  screen: number;
  code?: number;
  part?: string;
}

interface XRaySceneBase {
  slug: string;
  /** The frame at 1800px wide (desktop). */
  shot: StaticImageData;
  /** The same frame at 960px wide, about a third of the bytes (phones: see shotSrc). */
  shotSmall: StaticImageData;
  /** Logical size of the frame (geometry space), px. */
  size: Point;
  bodies: readonly XRayBody[];
  /** The device that must stay whole on narrow (phone) stages. */
  focus: Rect;
  tour: readonly XRayStop[];
}

interface XRaySceneDef extends XRaySceneBase {
  screens: readonly XRayScreenDef[];
}

/** A scene with its words in the visitor's language (localizeScenes). */
export interface XRayScene extends XRaySceneBase {
  screens: readonly XRayScreen[];
  project: LabProject;
}

/** The copy a scene needs, resolved by the section's `t` (home.xray). */
export interface XRayTexts {
  part: (key: XRayPartKey) => string;
  screen: (key: XRayScreenKey) => string;
  caption: (key: XRayCaptionKey) => string;
  /** "{width} {unit} wide". */
  width: (width: number, unit: XRayScreen['unit']) => string;
}

const DRIVE_ME: XRaySceneDef = {
  slug: 'driveme',
  shot: driveMeShot,
  shotSmall: driveMeShotSmall,
  size: [1200, 800],
  bodies: [
    {
      quad: [
        [81.7, 102.5],
        [380.6, 59.4],
        [449.1, 693.4],
        [162.2, 736.4],
      ],
      radius: 40,
    },
    {
      quad: [
        [809.4, 59.6],
        [1115.4, 98.4],
        [1034.8, 732.4],
        [730.9, 693.6],
      ],
      radius: 40,
    },
    {
      quad: [
        [421, 17],
        [779, 9],
        [779, 791],
        [421, 782],
      ],
      radius: 40,
    },
  ],
  focus: [421, 9, 779, 791],
  screens: [
    {
      name: 'TripScreen',
      copy: 'trip',
      quad: [
        [483, 200],
        [715, 200],
        [715, 700],
        [483, 700],
      ],
      unitWidth: 393,
      unit: 'pt',
      parts: [
        { id: 'map', copy: 'liveMap', tag: '<MapView />', note: 'Google Maps', box: [0, 0, 1, 0.58] },
        { id: 'route', copy: 'route', tag: '<Polyline />', note: 'route line', box: [0.3, 0.17, 0.59, 0.54] },
        { id: 'from', copy: 'pickup', tag: '<PlaceInput />', note: 'pickup', box: [-0.18, 0.58, 1.19, 0.654] },
        { id: 'to', copy: 'destination', tag: '<PlaceInput />', note: 'destination', box: [-0.13, 0.666, 1.13, 0.734] },
        {
          id: 'classes',
          copy: 'carClass',
          tag: '<CarClassPicker />',
          note: 'Business · Premium · Minivan',
          box: [0.017, 0.734, 1, 0.866],
        },
        { id: 'order', copy: 'order', tag: '<OrderButton />', note: 'primary action', box: [0.06, 0.905, 1, 0.981], pad: 0.13 },
      ],
      code: [
        {
          file: 'TripMap.tsx',
          copy: 'tripMap',
          at: [0.05, 0.1],
          lines: ['<MapView provider="google">', '  <Polyline coordinates={route}', '    strokeWidth={4} />', '</MapView>'],
        },
      ],
    },
    {
      name: 'PremiumTrip',
      copy: 'premium',
      quad: [
        [157, 243],
        [345, 225],
        [392, 645],
        [203, 660],
      ],
      unitWidth: 393,
      unit: 'pt',
      parts: [
        { id: 'premium-route', copy: 'fromTo', tag: '<RouteCard />', note: 'from · to', box: [0.03, 0.07, 0.97, 0.205] },
        {
          id: 'premium-classes',
          copy: 'premiumSelected',
          tag: '<CarClassPicker />',
          note: 'Premium',
          box: [0, 0.21, 1, 0.37],
        },
        { id: 'premium-hero', copy: 'fareUpFront', tag: '<TripHero />', note: 'class · fare from', box: [0.03, 0.38, 0.97, 0.75] },
        { id: 'premium-fee', copy: 'feeIncluded', tag: '<FeeNotice />', note: 'no surprises', box: [0.03, 0.76, 0.97, 0.855] },
        { id: 'premium-order', copy: 'order', tag: '<OrderButton />', note: 'primary action', box: [0.03, 0.865, 0.97, 0.96] },
      ],
      code: [
        {
          file: 'fare.ts',
          copy: 'fare',
          at: [-0.3, 0.4],
          lines: ['const route = await yandex', '  .route(a, b)', '  .catch(() => backup(a, b));', 'setFare(quote(route.km, car));'],
        },
      ],
    },
    {
      name: 'MinivanTrip',
      copy: 'minivan',
      quad: [
        [853, 228],
        [1048, 248],
        [1005, 658],
        [806, 640],
      ],
      unitWidth: 393,
      unit: 'pt',
      parts: [
        { id: 'minivan-route', copy: 'fromTo', tag: '<RouteCard />', note: 'from · to', box: [0.03, 0.06, 0.97, 0.2] },
        { id: 'minivan-classes', copy: 'minivanSelected', tag: '<CarClassPicker />', note: 'Minivan', box: [0, 0.21, 1, 0.37] },
        { id: 'minivan-hero', copy: 'fareUpFront', tag: '<TripHero />', note: 'class · fare from', box: [0.03, 0.38, 0.97, 0.74] },
        { id: 'minivan-fee', copy: 'feeIncluded', tag: '<FeeNotice />', note: 'no surprises', box: [0.03, 0.75, 0.97, 0.85] },
        { id: 'minivan-order', copy: 'order', tag: '<OrderButton />', note: 'primary action', box: [0.03, 0.86, 0.97, 0.96] },
      ],
      code: [
        {
          file: 'app/trip/[id].tsx',
          copy: 'openTrip',
          at: [0.08, 0.4],
          lines: ['router.push({', "  pathname: '/trip/[id]',", '  params: { id: order.id },', '});'],
        },
      ],
    },
  ],
  tour: [
    { screen: 0, code: 0 },
    { screen: 0, part: 'classes' },
    { screen: 1, code: 0 },
    { screen: 0, part: 'order' },
    { screen: 2, code: 0 },
  ],
};

const TES_CHAT: XRaySceneDef = {
  slug: 'tes-chat',
  shot: tesChatShot,
  shotSmall: tesChatShotSmall,
  size: [1200, 800],
  bodies: [
    {
      quad: [
        [65.3, 111.2],
        [384, 69],
        [458.4, 710.9],
        [139.7, 750.8],
      ],
      radius: 36,
    },
    {
      quad: [
        [795.8, 67.2],
        [1123.6, 106.5],
        [1054.5, 741.3],
        [726.7, 702],
      ],
      radius: 36,
    },
    {
      quad: [
        [403, 23],
        [777, 23],
        [777, 795],
        [403, 795],
      ],
      radius: 40,
    },
  ],
  focus: [403, 23, 777, 795],
  screens: [
    {
      name: 'ChatScreen',
      copy: 'chat',
      quad: [
        [421, 41],
        [759, 41],
        [759, 777],
        [421, 777],
      ],
      unitWidth: 360,
      unit: 'dp',
      parts: [
        { id: 'header', copy: 'groupHeader', tag: '<ChatHeader />', note: 'title · members', box: [0, 0.05, 1, 0.113] },
        { id: 'list', copy: 'history', tag: '<MessageList />', note: 'virtualized', box: [0, 0.113, 1, 0.899] },
        { id: 'bubble', copy: 'incoming', tag: '<Bubble />', note: 'sender · time', box: [0.136, 0.394, 0.799, 0.485] },
        { id: 'mine', copy: 'mineRead', tag: '<Bubble mine />', note: 'outgoing · read', box: [0.302, 0.654, 0.976, 0.72] },
        {
          id: 'composer',
          copy: 'composerRich',
          tag: '<Composer />',
          note: 'attach · emoji · voice',
          box: [0, 0.905, 1, 0.981],
          pad: 0.12,
        },
      ],
      code: [
        {
          file: 'ChatScreen.tsx',
          copy: 'longChats',
          at: [0.06, 0.15],
          lines: [
            'const msgs = useAppSelector(',
            '  s => selectThread(s, id));',
            '<FlatList inverted data={msgs}',
            '  renderItem={renderBubble} />',
          ],
        },
      ],
    },
    {
      name: 'ChannelScreen',
      copy: 'channel',
      quad: [
        [83, 125],
        [370, 87],
        [440, 691],
        [153, 727],
      ],
      unitWidth: 360,
      unit: 'dp',
      parts: [
        { id: 'channel-header', copy: 'channelHeader', tag: '<ChannelHeader />', note: 'title · channel', box: [0, 0.045, 1, 0.115] },
        { id: 'posts', copy: 'channelPosts', tag: '<PostList />', note: 'one to many', box: [0.2, 0.38, 1, 0.9] },
        { id: 'channel-composer', copy: 'composer', tag: '<Composer />', note: 'text · files', box: [0, 0.915, 1, 0.985] },
      ],
      code: [
        {
          file: 'outbox.ts',
          copy: 'offline',
          at: [0.07, 0.14],
          lines: ['// offline? queue it, send later', 'if (!net.online)', '  return outbox.push(msg);', 'ws.send(encode(msg));'],
        },
      ],
    },
    {
      name: 'AppearanceScreen',
      copy: 'appearance',
      quad: [
        [810, 85],
        [1102, 120],
        [1037, 717],
        [745, 682],
      ],
      unitWidth: 360,
      unit: 'dp',
      parts: [
        { id: 'preview', copy: 'themePreview', tag: '<ThemePreview />', note: 'sample chat', box: [0.03, 0.18, 0.97, 0.37] },
        {
          id: 'presets',
          copy: 'themePresets',
          tag: '<PresetPicker />',
          note: 'Classic · Day · Night · Tinted',
          box: [0, 0.43, 1, 0.545],
        },
        { id: 'accents', copy: 'accents', tag: '<AccentSwatches />', note: 'message accent', box: [0, 0.64, 1, 0.73] },
      ],
      code: [
        {
          file: 'appearance.ts',
          copy: 'themes',
          at: [0.08, 0.765],
          lines: ['setAppearance({', "  preset: 'classic',", '  accent: accents[4],', '});'],
        },
      ],
    },
  ],
  tour: [
    { screen: 0, code: 0 },
    { screen: 0, part: 'mine' },
    { screen: 2, code: 0 },
    { screen: 0, part: 'composer' },
    { screen: 1, code: 0 },
  ],
};

const TALIM_AI: XRaySceneDef = {
  slug: 'talim-ai',
  shot: talimShot,
  shotSmall: talimShotSmall,
  size: [1200, 800],
  bodies: [
    {
      quad: [
        [35, 23],
        [1166, 23],
        [1166, 776],
        [35, 776],
      ],
      radius: 14,
    },
  ],
  focus: [610, 23, 1166, 776],
  screens: [
    {
      name: 'LearnPage',
      copy: 'learn',
      quad: [
        [36, 68],
        [1165, 68],
        [1165, 775],
        [36, 775],
      ],
      unitWidth: 1440,
      unit: 'px',
      parts: [
        { id: 'topbar', copy: 'searchUpload', tag: '<TopBar />', note: 'search · upload · language', box: [0, 0, 1, 0.066] },
        { id: 'outline', copy: 'outline', tag: '<OutlineNav />', note: 'sections · actions', box: [0, 0.066, 0.179, 1] },
        { id: 'toolbar', copy: 'readerToolbar', tag: '<ReaderToolbar />', note: 'document · modes', box: [0.179, 0.066, 0.77, 0.17] },
        {
          id: 'tabs',
          copy: 'modes',
          tag: '<ModeTabs />',
          note: 'one source, four modes',
          box: [0.327, 0.076, 0.573, 0.113],
        },
        { id: 'reader', copy: 'source', tag: '<PdfReader />', note: 'page 1/6 · region select', box: [0.179, 0.17, 0.77, 1] },
        { id: 'panel', copy: 'studyPanel', tag: '<StudyPanel />', note: 'Learn · AI Tutor', box: [0.77, 0.066, 1, 1] },
        {
          id: 'ring',
          copy: 'progress',
          tag: '<ProgressRing />',
          note: 'current section',
          box: [0.849, 0.2, 0.929, 0.328],
          shape: 'circle',
        },
        {
          id: 'mastery',
          copy: 'mastery',
          tag: '<MasteryList />',
          note: 'score · review due',
          box: [0.787, 0.434, 0.991, 0.767],
        },
      ],
      code: [
        {
          file: 'retrieve.ts',
          copy: 'fromFile',
          at: [0.215, 0.48],
          lines: [
            '// answer only from the source',
            'const chunks = await sql`',
            '  SELECT text FROM chunks',
            '  WHERE doc_id = ${docId}',
            '  ORDER BY embedding <=> ${q}',
            '  LIMIT 8`;',
          ],
        },
        {
          file: 'Outline.tsx',
          copy: 'sections',
          at: [0.008, 0.6],
          lines: ['{sections.map(s =>', '  <SectionLink key={s.id}', '    done={s.done} {...s} />)}'],
        },
        {
          file: 'StudyPanel.tsx',
          copy: 'mastery',
          at: [0.79, 0.8],
          lines: ['<ProgressRing', '  value={mastery.current} />'],
        },
        {
          file: 'Reader.tsx',
          copy: 'askTutor',
          at: [0.24, 0.21],
          lines: ['<PdfReader src={doc.url}', '  onSelect={r => ask(r)} />'],
        },
      ],
    },
  ],
  tour: [
    { screen: 0, code: 3 },
    { screen: 0, code: 0 },
    { screen: 0, part: 'tabs' },
    { screen: 0, part: 'ring' },
    { screen: 0, code: 2 },
    { screen: 0, code: 1 },
  ],
};

function localizeScreen({ copy, parts, code, ...screen }: XRayScreenDef, texts: XRayTexts): XRayScreen {
  return {
    ...screen,
    label: texts.screen(copy),
    widthLabel: texts.width(screen.unitWidth, screen.unit),
    parts: parts.map(({ copy: partCopy, ...part }) => ({ ...part, label: texts.part(partCopy) })),
    code: code.map(({ copy: codeCopy, ...card }) => ({ ...card, caption: texts.caption(codeCopy) })),
  };
}

function localizeScene(def: XRaySceneDef, texts: XRayTexts): XRayScene | null {
  const project = getProjectBySlug(def.slug);
  return project ? { ...def, screens: def.screens.map(screen => localizeScreen(screen, texts)), project } : null;
}

/** Scenes whose project still exists in the portfolio data, in display order, in the visitor's language. */
export function localizeScenes(texts: XRayTexts): XRayScene[] {
  return [DRIVE_ME, TES_CHAT, TALIM_AI].map(def => localizeScene(def, texts)).filter((scene): scene is XRayScene => scene !== null);
}

/** Device pixels across the stage up to which the 960px frame is sharp enough (a phone at DPR 2-3). */
const SMALL_SHOT_MAX_PX = 1200;

/**
 * The frame to load for this screen: the 960px copy on phones, the full one
 * elsewhere. Client only (the X-ray renders on the client).
 */
export function shotSrc(scene: Pick<XRaySceneBase, 'shot' | 'shotSmall'>): string {
  const devicePx = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
  return devicePx <= SMALL_SHOT_MAX_PX ? scene.shotSmall.src : scene.shot.src;
}
