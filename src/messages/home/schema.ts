/**
 * Types of the `home` namespace, from the English files (en is the base that
 * ru/uz merge onto, see index.ts). global.d.ts adds it to next-intl's
 * AppConfig, so `useTranslations('home.xray')` and its keys are type-checked.
 * Add a key to en.json first; add a line here only for a new part.
 */
import type aiDemo from './ai-demo/en.json';
import type assembly from './assembly/en.json';
import type codeToUi from './code-to-ui/en.json';
import type crmBuild from './crm-build/en.json';
import type devices from './devices/en.json';
import type finale from './finale/en.json';
import type globe from './globe/en.json';
import type header from './header/en.json';
import type hero from './hero/en.json';
import type manifesto from './manifesto/en.json';
import type mobileBuild from './mobile-build/en.json';
import type numbers from './numbers/en.json';
import type posts from './posts/en.json';
import type process from './process/en.json';
import type ragBuild from './rag-build/en.json';
import type shared from './shared/en.json';
import type stackPhysics from './stack-physics/en.json';
import type telegram from './telegram/en.json';
import type webBuild from './web-build/en.json';
import type workWall from './work-wall/en.json';
import type xray from './xray/en.json';

// A type alias, not an interface: it must stay assignable to AbstractIntlMessages (implicit index signature).
export type HomeMessages = {
  hero: typeof hero;
  manifesto: typeof manifesto;
  xray: typeof xray;
  assembly: typeof assembly;
  'code-to-ui': typeof codeToUi;
  devices: typeof devices;
  telegram: typeof telegram;
  'mobile-build': typeof mobileBuild;
  'web-build': typeof webBuild;
  'rag-build': typeof ragBuild;
  'crm-build': typeof crmBuild;
  'ai-demo': typeof aiDemo;
  'work-wall': typeof workWall;
  numbers: typeof numbers;
  globe: typeof globe;
  process: typeof process;
  'stack-physics': typeof stackPhysics;
  finale: typeof finale;
  header: typeof header;
  shared: typeof shared;
  posts: typeof posts;
};
