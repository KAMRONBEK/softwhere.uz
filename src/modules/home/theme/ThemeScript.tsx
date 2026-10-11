import { LAB_PARAMS } from '../config';
import { STYLE_IDS } from '../types';
import { LAB_STYLES } from './styles';
import { STYLE_LINK_KEY, STYLE_STORAGE_KEY } from './themeStore';

/** Each style's page colour, for the phone's browser bar before React runs. */
const BACKGROUNDS = Object.fromEntries(STYLE_IDS.map(id => [id, LAB_STYLES[id].colors.bg]));

/**
 * Runs while the HTML is parsed, as the lab root's first child, before any of
 * the page below it is painted: picks the visitor's style with the same rules
 * as themeStore.ts (?style= wins for this visit and is kept in
 * sessionStorage, then that visit's link style, then localStorage, then the
 * cookie; nothing stored keeps the server's default) and sets `data-style` on
 * the root and the theme-color meta. The server always renders the default,
 * so the HTML stays the same for everyone (cacheable). React then reads the
 * same choice through useLabStyle() and keeps the attribute in sync. ES5 and
 * try/catch everywhere: it must never throw on an old or locked-down browser.
 * Built only from our own constants, so inlining it is safe.
 */
const BOOT_SCRIPT = `(function(){try{
var d=document,k=${JSON.stringify(STYLE_STORAGE_KEY)},sk=${JSON.stringify(STYLE_LINK_KEY)},ids=${JSON.stringify(STYLE_IDS)},bg=${JSON.stringify(BACKGROUNDS)},v=null;
function ok(x){return ids.indexOf(x)>-1}
try{var q=new URLSearchParams(location.search).get(${JSON.stringify(LAB_PARAMS.style)});q=q&&q.trim().toUpperCase();if(ok(q)){v=q;try{sessionStorage.setItem(sk,v)}catch(e){}}}catch(e){}
if(!ok(v)){try{v=sessionStorage.getItem(sk)}catch(e){}}
if(!ok(v)){try{v=localStorage.getItem(k)}catch(e){}}
if(!ok(v)){var m=d.cookie.match(new RegExp('(?:^|;\\\\s*)'+k+'=([^;]*)'));v=m&&m[1]}
if(!ok(v))return;
var s=d.currentScript,r=s&&s.parentElement;
if(r&&r.hasAttribute('data-lab-root'))r.setAttribute('data-style',v);
var t=d.querySelector('meta[name="theme-color"]');if(t)t.setAttribute('content',bg[v]);
}catch(e){}})();`;

/**
 * The pre-paint style script. The page renders it and LabShell places it as
 * the first child of the lab root (it must run inside the root, before the
 * sections are parsed). Server-safe: no hooks, no client code.
 */
export default function ThemeScript() {
  return <script id='lab-theme-boot' dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />;
}
