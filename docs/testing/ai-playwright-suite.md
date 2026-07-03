# AI Playwright Test Suite — softwhere.uz

> Machine-executable E2E test cases for an AI agent driving Playwright (MCP, accessibility-tree based: roles, accessible names, visible text).
> Generated 2026-07-03 from `main` @ `d93d906` by a multi-agent code exploration (5 area explorers + coverage critic + gap patch, all grounded in actual source).

## How to run

- Start the app: `npm run dev` → `http://localhost:3000`
- Locales: `en` / `ru` / `uz`; **default locale is `uz`** — `/` 308-redirects to `/uz` (see `src/proxy.ts`; the middleware file is `proxy.ts`, not `middleware.ts`)
- Viewports: desktop = 1280px+ (needed for the estimator step rail + live preview, both `hidden lg:*`); mobile = 390x844
- Locate elements by **role + accessible name or visible text**, never CSS classes. Match rail/step buttons by substring/regex (leading `1`/`✓` badges are part of the accessible name — see `est-rail-01`)
- Run rate-limit cases (`cf-05` step 3 and estimator API limits) **last** — they poison the per-IP window for 60s
- Priorities: **P0** = smoke (run always) · **P1** = core flows · **P2** = polish/a11y/edge

## Environment matrix

What each area needs beyond a bare `npm run dev` (no secrets → UI loads fine, submits fail gracefully):

### Home page, global navigation, footer, floating Telegram chat button, locale switching

Run the site locally with `npm run dev` (http://localhost:3000). No secrets are required to LOAD or navigate the home page or to trigger client-side contact-form validation. What needs backend/secrets: a SUCCESSFUL contact-form submit calls `POST /api/contact` (src/shared/utils/send.ts) which relays to a Telegram bot — it needs server env (bot token/chat id) and will otherwise toast "Something went wrong"; so only test the client-side validation toasts, not a real send. Vercel Analytics + SpeedInsights fire outbound requests (harmless if they fail). Theme choice persists via next-themes in localStorage. The portfolio slider (react-slick) has autoplay every 2500ms and AOS scroll animations, so slides auto-advance — hover the slider (pauseOnHover) or act quickly for a stable assertion. Language switch and the "secret admin" navigation use client-side router.push (no full page reload). The middleware lives in src/proxy.ts (not middleware.ts); locales are en/ru/uz with defaultLocale 'uz'.

### Estimator v2 wizard (/[locale]/estimator)

Run `npm run dev`; base URL http://localhost:3000, primary route /en/estimator (also /ru/estimator, /uz/estimator). DESKTOP viewport (>=1024px, Tailwind `lg`) is required to see the left Step rail (`hidden lg:flex`) and the right Live-estimate panel (`hidden lg:block`); MCP Playwright's default 1280px width satisfies this. Mobile-only sticky bottom bar appears below 1024px. START WITH CLEAN STORAGE: the wizard persists to sessionStorage key `estimator-state-v2` and currency to localStorage key `estimator-currency` — clear both (or use a fresh context) so the default is Mobile/E-commerce and USD, otherwise the quoted numbers/currency differ. CURRENCY: non-USD pills (UZS/KZT/RUB/EUR) only appear if GET /api/currency/rates succeeds (external open.er-api.com / EXCHANGERATE_API_KEY); in a network-sandboxed env only the USD pill shows. AI "second opinion" block: the result step POSTs /api/estimate which calls a paid LLM (Kimi/DeepSeek via safeGenerateJSONWithTimeout); WITHOUT provider keys it returns `ai:null` and the whole AI card is hidden (aiState 'unavailable') — the formula range still renders. LEAD persistence (POST /api/estimate/lead) writes to Neon Postgres via createLead → needs DATABASE_URL, else it returns 500; Telegram notification is optional (TG_BOT_TOKEN/TG_CHAT_ID) and fires via after(), never blocking the 200. RATE LIMITS are in-memory per-instance keyed by client IP; on localhost with no x-forwarded-for the key resolves to 'unknown', so all local calls share one bucket (estimate=10/60s, estimate-lead=5/60s) — run rate-limit cases in isolation and note that other cases hitting the same endpoint in the same 60s window consume the budget; restarting dev resets buckets.

### Blog — listing, post page, related posts, RSS feed, and public/generate APIs

DB: All reads use Neon Postgres via Drizzle (src/core/db.ts). DATABASE_URL must be set or getDb() throws. Graceful-degradation differs per surface: the listing page (src/app/[locale]/blog/page.tsx) wraps listPublished in try/catch and unstable_cache, so a DB error renders the EMPTY STATE (not an error); but GET /api/blog/posts returns 500 {"error":"Failed to fetch posts"} and /[locale]/feed.xml returns 500 "Feed unavailable" on DB error. An empty-but-reachable DB is fine: listing shows the empty-state copy, /api/blog/posts returns {"posts":[]}, feed renders an item-less <channel>, and post pages 404. Seed data: post-page and post-API cases need at least one PUBLISHED post (status='published') per locale — get a real slug first from GET /api/blog/posts?locale=en (field .posts[].slug) since slugs are AI-generated, not fixed. Related-posts cases need >=2 published posts sharing the same category+locale. Cross-locale redirect case needs a slug that exists only in a non-requested locale. Routing: default locale is 'uz' and next-intl uses always-prefix, so use /en, /ru, /uz explicitly; root "/" 308-redirects to /uz and a bare "/blog" (no locale) is NOT a route (404). Generate endpoint POST /api/blog/generate requires admin auth (Neon Auth admin-role session OR "Bearer ${API_SECRET}") PLUS an AI key (MOONSHOT_API_KEY or DEEPSEEK_API_KEY) and up to 300s runtime — only the unauthenticated 401 path is testable without secrets; the success path is not. Run locally with `npm run dev` on http://localhost:3000.

### Contact form + Admin area + auth

Admin auth (src/core/neonAuth.ts + core/auth.ts) needs: NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (must be >=32 chars or createNeonAuth throws; module defers construction so the public site still boots and admin "fails closed"). Human admin login also requires a Neon Auth user whose role is set to 'admin' in the Neon Console ("Make admin") — isAdminAuthenticated() checks `role === 'admin'`, not merely authenticated; Google OAuth button additionally needs Google provider configured. Machine/API access needs API_SECRET (Bearer path). DB: DATABASE_URL (Neon Postgres + Drizzle) is required for createLead/listLeads — contact/estimator submit and the admin Leads table are untestable without it (createLead throws -> route 500 -> UI shows "Something went wrong"). Telegram is OPTIONAL: without TG_BOT_TOKEN + TG_CHAT_ID the lead is still stored and the route returns success, and notifiedTelegram stays 'pending' (never 'sent'). Rate limiting (src/shared/utils/rateLimit.ts) is in-memory per-instance; `npm run dev` is a single instance and localhost usually has no x-forwarded-for so getClientIp() returns 'unknown' — all local calls share ONE bucket (e.g. key 'contact:unknown'), so the 429 cases reproduce after the 6th call in 60s but can also be tripped by unrelated concurrent tests (reset window is 60000ms). There is NO page at /[locale]/admin itself (only /admin/leads, /admin/posts, /admin/posts/new, /admin/posts/edit/[postId]) so hitting /en/admin bare is a 404, not the login screen — target /en/admin/leads or /en/admin/posts for the auth-gate UI. AdminInput labels ("Email"/"Password") are NOT associated (no htmlFor/id) so the login fields are best located by placeholder text.

### i18n integrity, SEO metadata, and infra/SEO endpoints (softwhere.uz)

Run `npm run dev` on http://localhost:3000. CRITICAL host gotcha: ENV.BASE_URL (src/core/constants.ts:61) defaults to `https://softwhere.uz` when NEXT_PUBLIC_BASE_URL is unset, so ALL absolute URLs emitted by the app locally (canonical, hreflang, og:url, og:image, sitemap <loc>, robots Sitemap: line, feed atom:link) contain the literal host `https://softwhere.uz`, NOT localhost. Assert on the path suffix (e.g. ends with `/en`) and treat the host as `${BASE_URL}`; if NEXT_PUBLIC_BASE_URL is set to a preview host, substitute it. DB-dependent (needs DATABASE_URL / reachable Neon Postgres): /api/health/db returning healthy, feed.xml <item>s, blog posts inside sitemap.xml, and the entire blog-post metadata case (needs at least one published post seeded). Outbound-internet dependent: /api/currency/rates fetches https://open.er-api.com (or exchangerate-api.com if EXCHANGERATE_API_KEY set); /api/og fetches fonts.googleapis.com for the Cyrillic Noto Sans subset (on failure it still returns a 200 PNG with a Latin fallback font, only the Cache-Control max-age differs). Message-file parity was statically verified clean: en.json / ru.json / uz.json each have exactly 405 leaf keys with zero missing keys in any direction, so no next-intl fallback should ever appear on the home page.

### Cross-cutting additions

Local run: `npm run dev` on http://localhost:3000. Default locale is uz (proxy.ts). SECRETS/DB matrix by case: (1) api-auth-01 depends on NEON_AUTH_* env — with it configured, an unauthenticated GET /api/auth/get-session returns 200 with a null session; with NEON_AUTH_* MISSING the wrapped handler 500s per-request (route.ts:15-23 wraps getAuth() so it does not throw at import). (2) adm-new-01 / adm-edit-01 need NO secrets — with NEON_AUTH_* absent, isAdminAuthenticated() fails closed (auth.ts:30-40) so the shared admin layout (layout.tsx:17-19) renders <AdminLogin/> for every admin subpage. (3) api-post-01: the no-auth 401 checks need no secrets; the Bearer-guarded 400 checks need API_SECRET set; the PATCH{status:'published'} publish and DELETE happy-paths additionally need DATABASE_URL and a real seeded UUID post id. (4) api-gen-02: the two validation 400s need API_SECRET (Bearer) but NO AI key (MOONSHOT_API_KEY/DEEPSEEK_API_KEY) and no DB — they short-circuit at route.ts:49-58 before any AI/DB call. (5) Blog cases (ce-01 blog-post step, mob-blog-01) require a seeded PUBLISHED post in DATABASE_URL for the target locale; with an empty DB the listing shows the empty state 'No posts available at the moment.' and any /blog/<slug> 404s. (6) mob-contact-01 client-side validation toasts need no backend; an actually-successful submit needs DATABASE_URL (createLead) — without it /api/contact returns 500 and a live Telegram ping needs TG_BOT_TOKEN+TG_CHAT_ID. (7) redir-01: the root '/' -> 308 -> '/uz' hop is fully testable locally; the www.softwhere.uz -> apex single-308 variant needs a spoofed Host header, which the accessibility-tree browser cannot set over plain localhost — exercise it with curl -H 'Host: www.softwhere.uz' against a deployed origin or note as manual. NOTE on gap #12: the cross-locale banner keys blog.availableIn/viewIn and the blog.showAllLocales/showCurrentLocale toggle exist ONLY in src/messages/*.json — grep finds no component that renders them, so there is no testable UI for them in the current code (BlogPostClient.tsx renders no such banner); the ScrollToTop button IS real and is covered by scroll-01.

---

## Home page, global navigation, footer, floating Telegram chat button, locale switching (16 cases)

#### `home-01` — Root path redirects to /uz and Uzbek home renders  `P0`

**Preconditions:** Dev server running at http://localhost:3000

**Steps:**
1. Navigate to http://localhost:3000/
2. Wait for the page to finish loading and the browser URL to settle

**Expected:** The browser lands on /uz (308 redirect followed automatically). The page renders exactly one level-1 heading containing 'Har qanday murakkablikdagi mobil ilovalar va veb-xizmatlarni ishlab chiqish.' and the eyebrow text 'Mahsulot studiyasi · Toshkent' is visible.

**Grounding (selectors/source):** src/proxy.ts: root '/' -> NextResponse.redirect(newUrl,308) with pathname '/uz'; defaultLocale 'uz'. UZ hero.title (uz.json): 'Har qanday murakkablikdagi mobil ilovalar va veb-xizmatlarni ishlab chiqish.'; hero.eyebrow 'Mahsulot studiyasi · Toshkent'

**Notes:** Confirms both the / -> /uz redirect and that 'uz' is the default locale.

#### `home-02` — English home loads and hero section renders fully  `P0`

**Preconditions:** Dev server running

**Steps:**
1. Navigate to http://localhost:3000/en
2. Take an accessibility snapshot of the hero region

**Expected:** Exactly one heading level 1 with text 'Development of mobile applications and web services of any complexity.'. Eyebrow 'Product studio · Tashkent' is visible. A link named 'Get Consultation' and a link named 'See our work' are both present. Two stat cards are visible with labels 'apps live on the App Store & Play Market' (numeric value counts up to 24) and 'countries, from Tashkent to Toronto' (numeric value counts up to 6).

**Grounding (selectors/source):** Hero (src/.../sections/Hero): h1 span = hero.title 'Development of mobile applications and web services of any complexity.'; eyebrow 'Product studio · Tashkent'; primary CTA <a href='#contact'> text 'Get Consultation'; secondary CTA <a href='#portfolio'> text 'See our work'; two stat labels 'apps live on the App Store & Play Market' and 'countries, from Tashkent to Toronto'; <Counter to={projects.length}=24> and <Counter to={6}>

**Notes:** Counter animates from 0; final values are 24 (projects.length) and 6.

#### `home-06` — Header desktop nav: anchor items scroll, route items navigate  `P0`

**Preconditions:** Desktop viewport (>=1024px wide) on http://localhost:3000/uz

**Steps:**
1. Navigate to http://localhost:3000/en (English labels are stable: Services, Work, AI, Blog, Estimate)
2. Click the nav link named 'Work'
3. Return to top, click the nav link named 'Services'
4. Click the nav link named 'Blog'

**Expected:** Clicking 'Work' navigates to /en#portfolio and scrolls the Projects section ('Our pride - projects') into view. Clicking 'Services' navigates to /en#services and scrolls the 'Our Services' block into view. Clicking 'Blog' navigates to the /en/blog route (URL path becomes /en/blog, no #hash). The 'Estimate' link points at /en/estimator and 'Let's talk' at /en#contact.

**Grounding (selectors/source):** Header nav Links: 'Services'->/uz#services, 'Work'->/uz#portfolio, 'AI'->/uz#ai, 'Blog'->/uz/blog, 'Estimate'->/uz/estimator; CTA pill 'Let's talk'->/uz#contact. UZ labels: header.services 'Xizmatlar', header.work uses key 'work'='Work'(en) — use /uz labels from uz.json

**Notes:** Header hides on scroll-down past 60px; scroll back to top before clicking a nav item if it is not reachable.

#### `home-07` — Portfolio slider: first slide is Talim AI; clicking a tab switches slide  `P0`

**Preconditions:** Desktop viewport on http://localhost:3000/en; the desktop tab row (hidden below lg) must be visible

**Steps:**
1. Navigate to http://localhost:3000/en
2. Scroll to the Projects section 'Our pride - projects'
3. Hover the slider to pause autoplay, then snapshot the active slide and the tab row
4. Click the tab button named 'View Netevia'

**Expected:** On load the tab button named 'View Talim AI' has aria-current=true and the active slide displays the bold project name 'Talim AI' with its English description text. After clicking 'View Netevia', the button named 'View Netevia' becomes aria-current=true and the slide content updates to show 'Netevia'.

**Grounding (selectors/source):** ProjectSlider: default useState activeSlide=1; projects[0] = { id:1, name:'Talim AI', website:'https://talim-ai.uz/' }; projects[2]='Netevia'. Tab buttons: role button aria-label t('viewProject',{name}) => 'View Talim AI','View Netevia'; active tab has aria-current=true. Slide content shows bold project name.

**Notes:** Autoplay advances every 2500ms; hover (pauseOnHover) before asserting. Talim AI shows only a website link (no App Store/Play badges); Netevia shows App Store, Play, and website links.

#### `home-08` — Floating Telegram chat button has correct link, target and label  `P0`

**Preconditions:** On http://localhost:3000/en (or /uz, /ru)

**Steps:**
1. Navigate to http://localhost:3000/en
2. Locate the fixed bottom-left circular link by its accessible name
3. Inspect its href, target and rel attributes

**Expected:** A link named 'Chat with us on Telegram' is present (fixed at bottom-left). Its href is exactly 'https://t.me/softwhereuz', target='_blank', and rel='noopener noreferrer'. On /ru the accessible name is 'Написать нам в Telegram' and on /uz it is 'Telegramda yozing'.

**Grounding (selectors/source):** TelegramChat (src/shared/components/TelegramChat/index.tsx): <a href={SOCIAL_LINKS.TELEGRAM}='https://t.me/softwhereuz' target='_blank' rel='noopener noreferrer' aria-label={t('telegramCta')} title={t('telegramCta')}>. en contact.telegramCta='Chat with us on Telegram'; ru='Написать нам в Telegram'; uz='Telegramda yозing'. Hidden when pathname includes '/admin'.

**Notes:** The same button is HIDDEN on any /admin route (component returns null when pathname includes '/admin').

#### `home-09` — Language switcher changes locale and preserves the current path  `P0`

**Preconditions:** Desktop viewport; start on http://localhost:3000/en

**Steps:**
1. Navigate to http://localhost:3000/en
2. Click the header language button (accessible name 'Language', currently showing 'EN') so aria-expanded becomes true
3. Click the option named 'Uz'
4. Then navigate to http://localhost:3000/en/estimator, open the language menu again and choose 'Uz'

**Expected:** After choosing 'Uz' from the English home, the URL becomes /uz and the h1 changes to the Uzbek 'Har qanday murakkablikdagi mobil ilovalar va veb-xizmatlarni ishlab chiqish.'. From /en/estimator, choosing 'Uz' navigates to /uz/estimator (the sub-path is preserved, only the leading locale segment changes).

**Grounding (selectors/source):** Header LanguageSwitcher: trigger button aria-label t('header.lang')='Language', shows current locale uppercase (e.g. 'EN'), aria-haspopup='true', aria-expanded toggles. Option buttons named 'En','Ru','Uz'. changeLanguage() rebuilds path as /{locale}/{restOfPath} via router.push. uz hero.title differs from en.

**Notes:** Two LanguageSwitchers exist in the DOM (desktop 'Language' + mobile); on a desktop viewport use the visible header one. Any #hash is not carried over (path only).

#### `home-11` — Mobile burger menu opens, navigates, and closes (390x844)  `P0`

**Preconditions:** Resize browser to 390x844 (mobile), on http://localhost:3000/en

**Steps:**
1. Resize the viewport to 390x844
2. Navigate to http://localhost:3000/en
3. Click the button named 'Open menu'
4. In the opened mobile nav, click the link named 'Estimate'

**Expected:** Before opening, the mobile nav (#mobile-nav) is inert/hidden. Clicking 'Open menu' sets its aria-expanded to true, the button's accessible name becomes 'Close menu', and the mobile nav reveals links Services, Work, AI, Blog, Estimate, and 'Let's talk'. Clicking 'Estimate' navigates to /en/estimator and (via toggleMenu) the mobile menu closes.

**Grounding (selectors/source):** Header burger <button aria-label={isOpen?t('closeMenu'):t('openMenu')}> => 'Open menu'/'Close menu', aria-expanded, aria-controls='mobile-nav'. Mobile <nav id='mobile-nav' inert={!isOpen}> links: 'Services','Work','AI','Blog','Estimate','Let's talk' (each onClick toggleMenu). Body gets class 'hide' while open.

**Notes:** The desktop nav <ul> is hidden at this width; the burger is the only nav affordance.

#### `home-03` — Russian home renders localized hero copy  `P1`

**Preconditions:** Dev server running

**Steps:**
1. Navigate to http://localhost:3000/ru
2. Read the h1 and the header navigation labels

**Expected:** The h1 reads 'Разработка мобильных приложений и веб-сервисов любой сложности.' and the eyebrow 'Продуктовая студия · Ташкент' is visible. The header shows the Russian nav item 'Услуги' and the CTA pill 'Обсудить'. No English hero string is shown.

**Grounding (selectors/source):** ru.json hero.title 'Разработка мобильных приложений и веб-сервисов любой сложности.'; hero.eyebrow 'Продуктовая студия · Ташкент'; header.services 'Услуги'; header.letsTalk 'Обсудить'

**Notes:** Proves next-intl swaps messages by URL locale, including header chrome.

#### `home-05` — Hero secondary/primary CTAs anchor-scroll to portfolio and contact  `P1`

**Preconditions:** On http://localhost:3000/en at top of page

**Steps:**
1. Navigate to http://localhost:3000/en
2. Click the link named 'See our work'
3. Observe the URL hash and viewport, then click the link named 'Get Consultation'

**Expected:** Clicking 'See our work' sets the URL to end with #portfolio and scrolls the 'Our pride - projects' section into view. Clicking 'Get Consultation' sets the URL to end with #contact and scrolls the 'Contact Us' section into view.

**Grounding (selectors/source):** Hero <a href='#portfolio'>'See our work'</a> and <a href='#contact'>'Get Consultation'</a>; Projects section id='portfolio' heading 'Our pride - projects'; Contact section id='contact' heading 'Contact Us'

**Notes:** These are same-page <a href='#...'> anchors, not route changes.

#### `home-10` — Footer contact links and attribution are correct  `P1`

**Preconditions:** On http://localhost:3000/en, scrolled to footer

**Steps:**
1. Navigate to http://localhost:3000/en
2. Scroll to the footer
3. Inspect the phone, email, 'Leave a request', and 'kamuran.dev' links

**Expected:** Footer shows a phone link '+998 33 249-91-11' with href 'tel:+998332499111', an email link 'kamuranbek98@gmail.com' with href 'mailto:kamuranbek98@gmail.com', the address text 'Tashkent, Uzbekistan', a 'Leave a request' link with href '#contact', the copyright line '© 2026 Softwhere. All rights reserved.' followed by 'Privacy Policy', and 'Developed by' with an external link 'kamuran.dev' (href 'https://kamuran.dev', target _blank).

**Grounding (selectors/source):** Footer: <a href='tel:+998332499111'>'+998 33 249-91-11'</a>; <a href='mailto:kamuranbek98@gmail.com'>'kamuranbek98@gmail.com'</a>; address value t('footer.addressValue')='Tashkent, Uzbekistan'; 'Leave a request' link <a href='#contact'> (t footer.requestLabel); copyright '© 2026 Softwhere. All rights reserved.' + 'Privacy Policy'; 'Developed by' <a href='https://kamuran.dev' target='_blank' rel='noopener noreferrer'>'kamuran.dev'</a>; footer logo Link href='/'

**Notes:** Footer email (kamuranbek98@) differs intentionally from the CLAUDE-context userEmail; assert exactly what the code renders.

#### `home-12` — Contact form client-side validation errors (empty phone, empty name)  `P1`

**Preconditions:** On http://localhost:3000/en, Contact section in view. No backend needed for validation.

**Steps:**
1. Navigate to http://localhost:3000/en and scroll to the 'Contact Us' section
2. Without filling anything, click the submit button named 'Send'
3. Now type a full phone number (e.g. select UZ and type '90 123-45-67' to reach 9+ digits), leave Name empty, click 'Send' again
4. Fill Name with 'Test', leave the message empty, click 'Send' again

**Expected:** Empty submit (phone only prefilled to +998, <9 digits) shows an error toast 'Enter phone number!' and an inline alert (role=alert) with the same text under the phone field; the form does NOT submit. With a valid phone but empty Name, the error is 'Enter your name!' with an inline role=alert under the name field. With valid phone + name but empty message, the error is 'Enter message!'. In none of these cases is a network request to /api/contact made.

**Grounding (selectors/source):** Contact form: PhoneInput defaultCountry='uz' (prefills +998, i.e. 3 digits < 9); name <input id='name' placeholder 'Your Name'>; message <textarea id='message' placeholder 'Enter your message here...'>; submit <Button type='submit'>'Send'. validateForm: phoneDigits.length<9 -> toast.error 'Enter phone number!' + <span role='alert'>; name.trim()==='' -> 'Enter your name!'; message empty -> 'Enter message!' (en toastMessage.*).

**Notes:** Validation order is phone -> name -> message and it returns on the first failure. A genuinely successful send hits POST /api/contact (needs server secrets) — do not assert success here.

#### `home-04` — Homepage renders all 8 sections in order, starting with the Hero  `P2`

**Preconditions:** Homepage at /en (or /uz). Desktop or mobile both acceptable.

**Steps:**
1. Navigate to http://localhost:3000/en.
2. Scroll from the top to the bottom, taking a snapshot at each section.
3. Verify the sections appear top-to-bottom in this exact order: (1) Hero, (2) Trust, (3) Service, (4) AISpotlight, (5) Process, (6) Projects, (7) Contact, (8) EstimatorCTA.

**Expected:** Eight sections render in order. Section 1 is the Hero (eyebrow 'Product studio · Tashkent' and the main h1), NOT the Trust marquee. Landmarks/text confirm order: Hero -> Trust ('Teams we've shipped with') -> Service (#services, 'What we do') -> AISpotlight (#ai, 'AI you can actually ship') -> Process ('How we work') -> Projects (#portfolio, 'Selected work') -> Contact (#contact, 'Contact Us') -> EstimatorCTA ('Want to estimate how much your project will cost?').

**Grounding (selectors/source):** [locale]/page.tsx renders, in order: Hero, Trust, Service, AISpotlight, Process, Projects, Contact, EstimatorCTA. Anchors/text: Hero eyebrow 'Product studio · Tashkent' (+ h1 headline); Trust label 'Teams we've shipped with'; Service id='services', eyebrow 'What we do'; AISpotlight id='ai', eyebrow 'AI you can actually ship'; Process eyebrow 'How we work'; Projects id='portfolio', eyebrow 'Selected work'; Contact id='contact', title 'Contact Us'; EstimatorCTA title 'Want to estimate how much your project will cost?'.

**Notes:** CORRECTED (gap #13): the draft home-04 listed the Trust marquee as section 1 and omitted the Hero. Fixed to make the Hero section 1 and renumber the remaining sections; Hero is rendered first in [locale]/page.tsx.

#### `home-13` — Theme toggle switches between light and dark  `P2`

**Preconditions:** On http://localhost:3000/en, desktop viewport

**Steps:**
1. Navigate to http://localhost:3000/en
2. Locate the header theme button by its accessible name ('Switch to dark mode' or 'Switch to light mode')
3. Click it once, then read its accessible name/aria-pressed again

**Expected:** The theme button toggles: if it started as 'Switch to dark mode' (aria-pressed=false), after clicking its accessible name becomes 'Switch to light mode' (aria-pressed=true) and the page visually switches to dark; clicking again reverts. The chosen theme persists on reload (next-themes localStorage).

**Grounding (selectors/source):** ThemeToggle: <button aria-label={isDark?'Switch to light mode':'Switch to dark mode'} aria-pressed={isDark}>. Uses next-themes; before mount renders an empty 36x36 placeholder.

**Notes:** Initial label depends on the system/persisted theme; assert that the label and aria-pressed flip on click rather than a fixed starting state.

#### `home-14` — Unknown locale segment returns a not-found page  `P2`

**Preconditions:** Dev server running

**Steps:**
1. Navigate to http://localhost:3000/fr

**Expected:** The request does NOT render the home hero. A 404 / not-found page is shown (the Uzbek and English hero headings are absent). The three valid locales /en, /ru, /uz all render the home page; anything else is not found.

**Grounding (selectors/source):** src/proxy.ts: isLocalePath = /^\/(en|ru|uz)(\/|$)/ ; non-locale like '/fr' falls through to Next which renders [locale] layout, and layout.tsx calls notFound() when !hasLocale(['en','ru','uz'], locale).

**Notes:** Negative/edge case for the locale gate in the layout.

#### `home-15` — Estimator CTA button navigates to the estimator route  `P2`

**Preconditions:** On http://localhost:3000/en, scrolled to the estimator CTA band

**Steps:**
1. Navigate to http://localhost:3000/en
2. Scroll to the section headed 'Want to estimate how much your project will cost?'
3. Click the button/link labeled 'Get Cost Estimate →'

**Expected:** The URL path becomes /en/estimator (the estimator page route). The CTA text on the home band is 'Get Cost Estimate →'.

**Grounding (selectors/source):** EstimatorCTA: <Link href={`/${locale}/estimator`}><Button>{t('cta')} →</Button></Link>; en estimatorCTA.cta='Get Cost Estimate' (rendered as 'Get Cost Estimate →'); heading 'Want to estimate how much your project will cost?'

**Notes:** Estimator page internals are a separate test area; here only assert the outbound navigation from the home CTA.

#### `home-16` — Secret admin: 5 clicks on the hidden top-left corner reveals the Admin button  `P2`

**Preconditions:** On http://localhost:3000/en, top of page

**Steps:**
1. Navigate to http://localhost:3000/en
2. Click the fixed top-left ~80x80px corner region (element with title 'Secret admin access') 5 times quickly (within 3 seconds)
3. Observe the top-right corner

**Expected:** After the 5th click a red button reading '🔐 Admin' (title 'Admin Panel Access') appears at the top-right for ~10 seconds. Clicking that '🔐 Admin' button navigates to /en/admin/posts.

**Grounding (selectors/source):** HomeClientLayer.tsx: invisible <div onClick={handleLogoClick} class='fixed top-0 left-0 w-20 h-20 cursor-pointer opacity-0' style z-1000 title='Secret admin access'/>. On the 5th click within 3s it shows <button title='Admin Panel Access'>🔐 Admin</button> (top-right, hidden again after 10s); clicking it router.push(`/${locale}/admin/posts`).

**Notes:** The trigger element is opacity-0 with no accessible name; target it by position (fixed top-left corner) / title attribute. Reaching /admin/posts content itself requires admin auth (separate area).

## Estimator v2 wizard (/[locale]/estimator) (20 cases)

#### `est-01` — Full happy-path walkthrough: Mobile / E-commerce through all 6 steps to the estimate  `P0`

**Preconditions:** Clean sessionStorage & localStorage; desktop viewport; USD default.

**Steps:**
1. Navigate to http://localhost:3000/en/estimator
2. Confirm the header h1 reads 'What will it cost to build?' and subtitle mentions 'honest price range at real Tashkent market rates'
3. Confirm the right Live-estimate panel already shows '$4,000 – $6,500' and '8–10 weeks · ≈292–464 h' (Mobile/E-commerce defaults)
4. Step 1 (Project): confirm card 'Mobile app' has aria-pressed=true and subtype 'E-commerce / Shop' is selected; click Next (button 'Next →')
5. Step 2 (Scope): confirm platform cards 'iOS' and 'Android' both selected, approach 'Cross-platform (Flutter / React Native)' selected with 'Popular' badge, tier 'MVP' selected; click 'Next →'
6. Step 3 (Features): confirm chips 'Product catalog','Cart & checkout','Orders & statuses','Push notifications','Search & filters','Admin panel' are selected (aria-pressed=true); click 'Next →'
7. Step 4 (Integrations): leave all unselected; click 'Next →'
8. Step 5 (Technology): confirm 'Let SoftWhere choose' card selected; click 'Next →'
9. Step 6 (Details): confirm design 'Custom design' selected, languages 'Two (uz + ru)' selected, urgency 'Normal' selected; click the final button 'See estimate →'

**Expected:** Result step renders: badge '✳ Your estimate is ready', h2 "Here's your honest range.", hero 'Estimated budget' with range '$4,000 – $6,500', sub-line '≈ 292–464 h · blended rate $14/hour (design + development + QA + PM)', Timeline card '8–10 weeks', Support card '$40/mo'. Progress bar reaches 100%. No contact form is required to view the estimate (result is never gated).

**Grounding (selectors/source):** h1 'What will it cost to build?'; eyebrow 'Project estimator'; Next button text 'Next →'; last-step button 'See estimate →'; rail items 'Project','Scope','Features','Integrations','Technology','Details','Estimate'

#### `est-09` — Navigation: Back/Next, step-rail jumps, progress bar, and NO validation gating  `P0`

**Preconditions:** Clean storage; desktop.

**Steps:**
1. Navigate to /en/estimator
2. Confirm on step 1 there is NO Back button and the primary button reads 'Next →'
3. Click 'Next →' repeatedly WITHOUT making any selections and confirm you advance through every step (no validation error blocks progression)
4. On any middle step confirm '← Back' appears and returns to the previous step
5. In the left rail, click 'Estimate' (last rail item) to jump straight to the result; then click 'Scope' in the rail to jump back to step 2
6. Observe the thin progress bar as the step changes (0% on Project, ~83% on Details, 100% on Estimate)

**Expected:** The wizard applies no per-step gating: Next always advances and no field is required to reach the estimate. Back appears from step 2 onward. Rail items are directly clickable and jump to any step including 'Estimate'. Progress = round(step/6×100)%. Completed rail steps show a '✓'; the active step has aria-current=true.

**Grounding (selectors/source):** Next 'Next →'; Back '← Back'; final 'See estimate →'; rail buttons named 'Project','Scope','Features','Integrations','Technology','Details','Estimate'; mobile step text 'Step 1 of 6'

#### `est-12` — Result panel contents: hero range, timeline, support, breakdown accordion, included/excluded/terms, AI (hidden when unavailable)  `P0`

**Preconditions:** Reach result via Mobile/E-commerce defaults; USD; AI keys likely absent.

**Steps:**
1. From Mobile/E-commerce defaults advance to the result step
2. Confirm hero: label 'Estimated budget', range '$4,000 – $6,500', sub '≈ 292–464 h · blended rate $14/hour (design + development + QA + PM)'
3. Confirm the two stat cards: 'Timeline' → '8–10 weeks' and 'Support (optional)' → '$40/mo'
4. Click 'How we calculated this' (aria-expanded toggles true) and confirm the breakdown lists the base line 'E-commerce / Shop' plus per-feature hour rows, ending with 'Scope multiplier...' '×1.22' and 'Blended hourly rate' '$14/h'
5. Confirm the 'Included' list (UI/UX design, Development, Testing (QA), Project management, Launch & deployment, 12-month bug-fix warranty), 'Not included' (Hosting & domains; App Store / Google Play fees; Paid third-party services; Content & photography), and 'How we work' (50% to start, 50% on delivery; Milestone payments on larger projects; Free bug fixes for 12 months)
6. Observe the AI section: with no LLM keys it is absent; with keys it shows '🤖 AI second opinion' (loading spinner 'Our AI is reviewing your scope — usually 20–40 seconds…' then a refined range + confidence badge)
7. Click 'Start over'

**Expected:** Result renders the full formula breakdown with multiplier ×1.22 and rate $14/h; the AI card is hidden entirely when the API returns ai:null (aiState 'unavailable') and never blocks the formula range. 'Start over' resets to step 1 with Mobile defaults and clears sessionStorage.

**Grounding (selectors/source):** badge '✳ Your estimate is ready'; h2 "Here's your honest range."; 'Estimated budget'; 'Timeline'; 'Support (optional)' + '/mo'; button 'How we calculated this' aria-expanded; breakdown rows 'E-commerce / Shop','Product catalog', 'Scope multiplier (level, design, languages, platforms, urgency)' '×1.22', 'Blended hourly rate' '$14/h'; 'Included'/'Not included'/'How we work'; AI heading '🤖 AI second opinion'; 'Start over'

#### `est-13` — Lead form validation and successful submit UI  `P0`

**Preconditions:** On result step; DATABASE_URL configured for a real 200 (else expect submit error UI).

**Steps:**
1. Scroll to the lead form 'Send this estimate to SoftWhere' on the result step
2. Click 'Send my estimate' with all fields empty
3. Confirm a role='alert' shows 'Please enter your name'
4. Type 'Aziz' into 'Your name' (id lead-name) and click 'Send my estimate' again
5. Confirm the alert changes to 'Please enter a valid phone number' (phone incomplete for +998, needs 9 local digits)
6. Fill the phone field with a complete UZ number (e.g., 90 123 45 67) and click 'Send my estimate'
7. Observe the button change to 'Sending…' then the outcome

**Expected:** Validation is client-side and sequential: empty name → 'Please enter your name'; valid name but incomplete phone → 'Please enter a valid phone number'. On a valid submit the form POSTs to /api/estimate/lead; success replaces the form with '✅ Estimate sent!' + 'We got your configuration and will reach out shortly...'. If the API fails (e.g., no DATABASE_URL → 500) the alert shows 'Couldn't send — please try again or write to us on Telegram'. Default contact method is Telegram.

**Grounding (selectors/source):** form title 'Send this estimate to SoftWhere'; input id 'lead-name' label 'Your name' placeholder 'John'; PhoneInput id 'lead-phone' label 'Phone number' default country uz; contact pills '✈️ Telegram' (default) / '📞 Call me'; textarea id 'lead-comment'; submit 'Send my estimate' / 'Sending…'; error role='alert' texts 'Please enter your name','Please enter a valid phone number'; success '✅ Estimate sent!'

#### `est-14` — API contract: POST /api/estimate valid body returns 200 with formula shape  `P0`

**Preconditions:** Dev server running; within estimate rate-limit window (<=10/60s).

**Steps:**
1. Send POST http://localhost:3000/api/estimate with header Content-Type: application/json and body {"input":{"projectType":"mobile","subtype":"ecommerce","platforms":["ios","android"],"approach":"cross","tier":"mvp","screens":15,"features":["catalog","cart_checkout","orders","push","search","admin_panel"],"integrations":[],"techStack":[],"autoTech":true,"design":"custom","languages":2,"urgency":"normal","description":""},"locale":"en"}
2. Read the JSON response

**Expected:** HTTP 200 with {success:true, data:{formula, ai}}. formula.cost = {min:4000, max:6500}, formula.hours = {min:292, max:464}, formula.weeks = {min:8, max:10}, formula.supportMonthly:40, formula.rate:14, formula.multiplier:1.22, formula.team:['team.pm','team.designer','team.dev'], and formula.breakdown is a non-empty array. data.ai is an object {cost, weeks, summary, risks[], suggestions[], confidence, provider} when LLM keys exist, otherwise null. The server re-computes from sanitized input (client numbers are never trusted).

**Grounding (selectors/source):** route src/app/api/estimate/route.ts; method POST; header Content-Type: application/json; response {success, data:{formula, ai}}

#### `est-02` — Step 1 Type: switching project type resets subtype list and live estimate  `P1`

**Preconditions:** Clean storage; desktop; on step 1.

**Steps:**
1. Navigate to /en/estimator (step 1 'What are we building?')
2. Confirm 6 service cards render with the exact titles listed and 'Mobile app' has aria-pressed=true
3. Confirm the subtype section 'What kind exactly?' lists mobile subtypes incl. 'E-commerce / Shop','Delivery / Logistics','Booking / Services','Fintech / Wallet'
4. Click the card 'Website / Web app'
5. Confirm 'Website / Web app' now aria-pressed=true and the subtype list changed to web subtypes: 'Landing page','Corporate website','E-commerce / Shop','SaaS / Web platform','Portal / Marketplace','CRM / ERP system' with 'Landing page' selected by default
6. Read the right Live-estimate panel range

**Expected:** After choosing Website / Web app + default subtype Landing page, the Live-estimate panel updates to '$400 – $650' (landing baseHours 23, custom design ×1.15, 2 languages ×1.06). Selecting a new service type replaces the subtype grid and re-defaults selections (only the free-text description is preserved across type switches).

**Grounding (selectors/source):** service cards text 'Mobile app','Website / Web app','Telegram bot / Mini App','AI solution','Desktop app','Other / Not sure'; subtype cards 'Landing page','Corporate website','SaaS / Web platform','Portal / Marketplace','CRM / ERP system','E-commerce / Shop'; role=button aria-pressed

#### `est-03` — Step 2 Scope (mobile): platform toggles enforce >=1, approach shows +% delta, screens slider  `P1`

**Preconditions:** Mobile/E-commerce default; desktop; navigate Next to step 2.

**Steps:**
1. From step 1 click 'Next →' to reach Scope
2. Confirm both 'iOS' and 'Android' are selected (aria-pressed=true)
3. Click 'iOS' to deselect it; confirm 'Android' stays selected
4. Click 'Android' (now the only selected platform) and confirm it CANNOT be deselected — it remains aria-pressed=true (engine never allows zero platforms)
5. Confirm the Native approach card desc reads 'A separate codebase per platform — maximum performance (+55%)' when both platforms are on (re-select iOS first); with a single platform selected the delta changes to '(+12%)'
6. Confirm tier cards 'MVP'/'Standard'/'Enterprise' render with 'MVP' selected
7. Drag/set the screens range input (id='screens', min=1 max=60) to a higher value and read the numeric readout box

**Expected:** At least one platform is always selected (deselecting the last platform is a no-op). The native approach card's percentage reflects platform count: +55% for both, +12% for single. The screens slider's numeric box mirrors the input value and the hint states 15 screens are included; increasing screens above 15 raises the live estimate.

**Grounding (selectors/source):** platform cards 'iOS' (🍎) / 'Android' (🤖); approach 'Cross-platform (Flutter / React Native)' badge 'Popular', 'Native (Swift + Kotlin)' desc ends '(+55%)'; tier cards 'MVP','Standard','Enterprise'; range input id 'screens' aria-label 'Screens / pages'; hint '15 screens are already included in the base price'

#### `est-04` — Tier change updates live estimate and suggested team (Standard adds QA + 2+ developers)  `P1`

**Preconditions:** Mobile/E-commerce default; desktop.

**Steps:**
1. Navigate to Scope (step 2)
2. Read the Live-estimate panel range (should be '$4,000 – $6,500' at MVP)
3. Click the tier card 'Standard'
4. Read the updated Live-estimate range
5. Advance to the result step (click Next through to 'See estimate →') and read the 'Suggested team' pills

**Expected:** Selecting Standard raises the live range to '$5,500 – $9,000' (tier ×1.4). On the result step the Suggested team shows 'Project manager', 'UI/UX designer', '2+ developers' and 'QA engineer' (QA is added for any tier above MVP; '2+ developers' appears once hours exceed 400). At MVP the team is only 'Project manager','UI/UX designer','Developer'.

**Grounding (selectors/source):** tier cards 'MVP','Standard','Enterprise'; team pills 'Project manager','UI/UX designer','Developer','2+ developers','QA engineer'

#### `est-05` — Step 3 Features: popular pre-selection, category headings, price hints, toggling lowers estimate  `P1`

**Preconditions:** Mobile/E-commerce default; desktop; on step 3.

**Steps:**
1. From Scope click 'Next →' to reach Features ('What should it do?')
2. Confirm category headings render and pre-selected chips 'Product catalog','Cart & checkout','Orders & statuses','Push notifications','Search & filters','Admin panel' show aria-pressed=true
3. Confirm each pre-selected chip that is 'popular' for this subtype renders a '★ popular' badge and every chip shows a price hint like '+$...'
4. Read the Live-estimate range (expected '$4,000 – $6,500')
5. Click the 'Admin panel' chip to deselect it
6. Re-read the Live-estimate range and the Live panel 'Features' count row

**Expected:** Deselecting 'Admin panel' lowers the live range to '$3,600 – $5,750' and the Live panel 'Features' count drops from 6 to 5. Price hints are rendered as '+$<rounded-to-10>' (feature hours × $14 × tier). Toggling any feature updates the estimate immediately.

**Grounding (selectors/source):** category headers 'Users & access','Content & admin','Commerce','Communication','Maps & logistics','Data & analytics','Artificial intelligence','Platform & infrastructure'; chips 'Admin panel','Product catalog','Cart & checkout'; popular badge '★ popular'; hint format '+$310' etc.

#### `est-10` — Live preview updates on every selection (desktop panel + mobile sticky bar)  `P1`

**Preconditions:** Clean storage; USD.

**Steps:**
1. Navigate to /en/estimator at desktop width and confirm the right panel labeled 'Live estimate' shows '$4,000 – $6,500', '8–10 weeks · ≈292–464 h', and summary rows Project 'E-commerce / Shop', Level 'MVP', Screens '15', Features '6', Integrations '0'
2. Change any input (e.g., toggle a feature or change tier) and confirm the range and the relevant summary-row count update immediately without a page reload
3. Resize the browser to a mobile width (e.g., 390×800)
4. Confirm the desktop panel is hidden and a fixed bottom bar appears with 'Live estimate', the same range, a back '←' button (aria-label 'Back', from step 2), and a 'Next →' button
5. Advance to the result step and confirm the mobile sticky bar disappears

**Expected:** The live formula range recomputes synchronously on every selection (client-side calculateEstimate). Desktop uses the sticky right panel with summary rows; below 1024px the same range is shown in a fixed bottom action bar which is hidden on the result step.

**Grounding (selectors/source):** desktop aside label 'Live estimate'; range node '$4,000 – $6,500'; summary rows 'Project','Level','Screens','Features','Integrations'; mobile sticky bar label 'Live estimate' + range + ← + 'Next →'

#### `est-11` — Currency switching and persistence (USD/UZS/KZT/RUB/EUR from /api/currency/rates)  `P1`

**Preconditions:** Clean localStorage (no estimator-currency); /api/currency/rates reachable for non-USD pills.

**Steps:**
1. Navigate to /en/estimator at desktop width; in the Live panel confirm the 'Currency' label and a 'USD' pill selected (aria-pressed=true)
2. Confirm additional pills 'UZS','KZT','RUB','EUR' render ONLY if the rates fetch succeeded (otherwise just 'USD')
3. Click the 'UZS' pill
4. Confirm the range figures switch from '$' formatting to UZS formatting and the numeric magnitude increases (amounts × the UZS rate, rounded to 3 significant digits)
5. Reload the page and confirm the currency selection persists (UZS still selected) via localStorage key 'estimator-currency'

**Expected:** Rates come from GET /api/currency/rates (external open.er-api.com, base USD, 24h cache). Only currencies with a fetched rate are offered; a stored currency is re-applied only once its rate exists (never mislabels USD as UZS). Selection persists to localStorage. If rates are unavailable the switcher shows USD only and all amounts stay in USD.

**Grounding (selectors/source):** Live panel label 'Currency'; SegmentedPill buttons 'USD','UZS','KZT','RUB','EUR' (aria-pressed); source GET /api/currency/rates (open.er-api.com base USD)

#### `est-15` — API contract: POST /api/estimate rejects malformed/invalid bodies with 4xx  `P1`

**Preconditions:** Dev server; within rate-limit window.

**Steps:**
1. POST /api/estimate with a non-JSON text body like 'not-json' → read status/error
2. POST /api/estimate with valid JSON but missing/invalid input, e.g. {"input":{"projectType":"hacker"},"locale":"en"} → read status/error
3. POST /api/estimate with {"input":{"projectType":"web","subtype":"landing","features":["<script>","nonexistent","analytics_setup"]}} → read status/error
4. (Optional) POST a body larger than 32KB → read status

**Expected:** Non-JSON → 400 {success:false, error:'Invalid JSON body'}. projectType not in the catalog → sanitizeEstimatorInput returns null → 400 {success:false, error:'Invalid estimator input'}. The web/landing body with unknown feature ids → 200 success: unknown ids are silently dropped and only 'analytics_setup' is counted (stale clients degrade, never error). A body >32768 bytes → 413 {error:'Request body too large'}.

**Grounding (selectors/source):** errors 'Invalid JSON body' (400), 'Invalid estimator input' (400), 'Request body too large' (413)

#### `est-16` — API rate limit: POST /api/estimate returns 429 after 10 requests/60s with Retry-After  `P1`

**Preconditions:** Run in isolation; localhost IP key 'estimate:unknown'; buckets reset on dev restart.

**Steps:**
1. Rapidly send 10 POST /api/estimate requests in the same 60s window (bodies may be minimal/invalid JSON — the rate check runs before parsing, so each still counts)
2. Send an 11th POST /api/estimate within the same window
3. Inspect the 11th response status and headers

**Expected:** The first 10 requests pass the limiter (they may 200/400 depending on body); the 11th returns HTTP 429 with body {success:false, error:'Too many requests. Please try again shortly.'} and a 'Retry-After' header (seconds until the 60s window resets). Limit is per-instance/per-IP (10/60s).

**Grounding (selectors/source):** rateLimit(`estimate:...`, 10, 60_000); 429 body {error:'Too many requests. Please try again shortly.'}; header 'Retry-After'

#### `est-17` — API contract: POST /api/estimate/lead valid submit (200) and required-field rejection (400)  `P1`

**Preconditions:** DATABASE_URL configured for the 200 path (else 500); within lead rate-limit window (<=5/60s).

**Steps:**
1. POST http://localhost:3000/api/estimate/lead with body {"name":"Aziz","phone":"+998901234567","contact":"telegram","locale":"en","input":{"projectType":"mobile","subtype":"ecommerce","platforms":["ios","android"],"approach":"cross","tier":"mvp","screens":15,"features":["catalog"],"integrations":[],"techStack":[],"autoTech":true,"design":"custom","languages":2,"urgency":"normal","description":""}} → read status
2. POST the same with "phone":"12345" (only 5 digits) → read status/error
3. POST the same with "name":"" → read status/error
4. POST with a valid name/phone but {"input":{"projectType":"bogus"}} → read status/error

**Expected:** Valid submit → 200 {success:true} (lead stored via createLead; Telegram fires via after() only if TG_BOT_TOKEN/TG_CHAT_ID set; without DATABASE_URL the DB insert fails → 500 {error:'Internal server error'}). Phone with <9 digits OR empty name → 400 {success:false, error:'Name and phone are required'}. Invalid input.projectType → 400 {error:'Invalid estimator input'}. Server recomputes the formula and re-clamps any echoed ai block; client numbers are display-only.

**Grounding (selectors/source):** route src/app/api/estimate/lead/route.ts; success {success:true}; 400 'Name and phone are required'; 400 'Invalid estimator input'

#### `est-19` — Sanitize / XSS edge cases: free-text never executes; API drops unknown ids and control chars  `P1`

**Preconditions:** On Details/result step (browser part); dev server (API part).

**Steps:**
1. In the Details step description textarea, type an XSS payload like <img src=x onerror="document.title='XSS'"> and also <script>alert('x')</script>
2. Advance to the result step; if any dialog appears, dismiss it, and confirm document.title is unchanged (payload rendered as inert text, never executed)
3. Fill the lead name with a newline-injection attempt 'Hacker\nPhone: +1 000-000' and submit (or POST /api/estimate/lead with that name) — this exercises cleanLine collapsing newlines so a crafted name cannot forge extra 'Phone:'/'Estimate:' lines in the owner notification
4. Via API, POST /api/estimate with input.description containing NUL/control chars and >600 chars, plus features:['<script>','analytics_setup'] on projectType 'web'/'landing'
5. Read the API status

**Expected:** React renders all free-text as literal text — no script executes, no alert, document.title unchanged. The API's sanitizeEstimatorInput strips control chars from description, hard-caps it at 600 chars, and drops unknown feature/integration/tech ids while still returning 200. The lead route's cleanLine strips control/bidi chars and collapses newlines to spaces so injected 'Phone:' lines cannot be forged; owner-facing Telegram output is additionally escapeHtml-ed.

**Grounding (selectors/source):** description textarea; lead name id 'lead-name'; sanitize.ts strips  - & bidi; cleanLine collapses newlines; escapeHtml on Telegram output

#### `est-06` — Step 4 Integrations: regional groups, toggling Payme adds to integration count and cost  `P2`

**Preconditions:** Mobile/E-commerce default; desktop; on step 4.

**Steps:**
1. Navigate to Integrations (step 4, title 'Integrations')
2. Confirm the group headings render and chips 'Payme','Click','Uzum Bank' appear under 'Payments — Uzbekistan' each with a '+$...' hint
3. Confirm the Live panel 'Integrations' count row shows 0
4. Click the 'Payme' chip
5. Read the updated Live-estimate range and the 'Integrations' count row

**Expected:** Toggling 'Payme' sets aria-pressed=true, increments the Live panel 'Integrations' count to 1, and raises the live range (Payme = 16 fixed hours, added un-multiplied). For a desktop project type the 'Maps & geo' group is hidden (integrationsFor filters maps for desktop) — verify by switching type to Desktop app and re-opening Integrations.

**Grounding (selectors/source):** group headers 'Payments — Uzbekistan','Payments — international & CIS','SMS & notifications','Maps & geo','Business systems & CRM','Government & identity (UZ)'; chips 'Payme','Click','Uzum Bank','Stripe','Eskiz SMS','1C sync','MyID (KYC)'; hint '+$220' style

#### `est-07` — Step 5 Technology: auto-pick default, manual pick de-selects auto, type-scoped list  `P2`

**Preconditions:** Mobile/E-commerce default; desktop; on step 5.

**Steps:**
1. Navigate to Technology (step 5, title 'Technology stack')
2. Confirm 'Let SoftWhere choose' card is selected (aria-pressed=true) and the tech chip groups below are dimmed (opacity-60)
3. Confirm the Mobile group lists 'Flutter','React Native','Expo','Swift (iOS)','Kotlin (Android)'
4. Click the 'Flutter' chip
5. Confirm 'Flutter' is now selected and 'Let SoftWhere choose' becomes de-selected (aria-pressed=false)

**Expected:** Picking any explicit technology turns off autoTech; the manual chips are no longer dimmed. Tech options are scoped to the project type (mobile shows Flutter/React Native/Swift/Kotlin; switching to Web replaces them with Next.js/React/Vue/etc.). Technology choice does not change price except native mobile (per techHint).

**Grounding (selectors/source):** SelectCard 'Let SoftWhere choose' desc "We'll pick the optimal stack for your budget and scale" badge 'Popular'; tech chips 'Flutter','React Native','Expo','Swift (iOS)','Kotlin (Android)'; group headers 'Mobile','Frontend','Backend','Databases & storage','Cloud & DevOps','AI & ML','CMS & platforms'

#### `est-08` — Estimator Details step: description textarea placeholder (exact full string)  `P2`

**Preconditions:** On the estimator Details step (advance through all prior steps).

**Steps:**
1. Navigate to /en/estimator and advance to the Details step.
2. Locate the description textarea under the 'Describe your idea (optional)' label.
3. Assert its placeholder equals, exactly: 'E.g.: a delivery app for our restaurant chain in Tashkent with courier tracking and Payme payments…' (note the full 'with courier tracking and Payme payments…' tail and the trailing … ellipsis character).
4. Type text and confirm the character counter (N/MAX_DESCRIPTION_LENGTH) updates.

**Expected:** The textarea placeholder is the full en.json:259 string 'E.g.: a delivery app for our restaurant chain in Tashkent with courier tracking and Payme payments…'. Typing updates the 'N/MAX' counter below the field.

**Grounding (selectors/source):** DetailsStep.tsx:70-77 — StepLabel 'Describe your idea (optional)' (descriptionTitle) with hint 'One or two sentences help the AI catch scope that checkboxes miss.' (descriptionHint); the <textarea rows={4}> uses placeholder t('descriptionPlaceholder').

**Notes:** CORRECTED (correction #3): the draft quoted a truncated placeholder ('...in Tashkent…'). Fixed to the complete string including 'with courier tracking and Payme payments…' so an exact-string assertion passes.

#### `est-18` — API rate limit: POST /api/estimate/lead returns 429 after 5 requests/60s  `P2`

**Preconditions:** Run in isolation; key 'estimate-lead:unknown'.

**Steps:**
1. Send 5 POST /api/estimate/lead requests within 60s (bodies may be missing name/phone → 400, but they still count against the limiter which runs first)
2. Send a 6th POST /api/estimate/lead within the same window
3. Inspect the 6th response

**Expected:** The 6th request returns HTTP 429 with {success:false, error:'Too many requests. Please try again shortly.'} and a 'Retry-After' header. The lead limit is 5/60s per IP (stricter than /api/estimate because it writes to the DB and pings Telegram).

**Grounding (selectors/source):** rateLimit(`estimate-lead:...`, 5, 60_000); 429 {error:'Too many requests. Please try again shortly.'} + Retry-After

#### `est-20` — Session persistence: refresh mid-wizard restores step & config; Start over clears it  `P2`

**Preconditions:** Clean sessionStorage; desktop.

**Steps:**
1. Navigate to /en/estimator, switch type to 'Website / Web app' / 'Corporate website', change tier to 'Standard', and advance to the Features step (step 3)
2. Reload the page
3. Confirm the wizard restores to the Features step with Website/Corporate website and Standard tier still selected (input + step rehydrated from sessionStorage)
4. Advance to the result and click 'Start over'
5. Reload again and confirm the wizard is back at step 1 with Mobile/E-commerce defaults (sessionStorage cleared)

**Expected:** State persists to sessionStorage key 'estimator-state-v2' and is restored on reload (step restored only if 0<=step<6; corrupted/garbled stored state degrades to defaults via the same sanitizer instead of crashing). 'Start over' removes the stored state and resets to Mobile/E-commerce step 1.

**Grounding (selectors/source):** sessionStorage key 'estimator-state-v2' (JSON {input, step}); 'Start over' link removes it

## Blog — listing, post page, related posts, RSS feed, and public/generate APIs (14 cases)

#### `blog-01` — Blog listing (en) renders post grid or the exact empty state  `P0`

**Preconditions:** Dev server running; DATABASE_URL set. Works whether or not any en posts are published.

**Steps:**
1. Navigate to http://localhost:3000/en/blog
2. Read the page heading and intro paragraph
3. Inspect the main content region for either a card grid or an empty-state message

**Expected:** Page heading (h1) is exactly 'Blog'. Intro paragraph reads 'Expert insights on mobile app development, AI solutions, web development, and more'. If published en posts exist: a grid of cards, each card has an article-title link and a link named 'Read More' pointing to /en/blog/<slug>, plus a date formatted like 'January 15, 2026'. If no en posts exist: a single paragraph with the exact text 'No posts available at the moment.' and no cards.

**Grounding (selectors/source):** h1 text 'Blog' (blog.title); intro from blog.description; empty copy 'No posts available at the moment.' (blog.noPostsAvailable); card CTA link text 'Read More' (blog.readMore); card links href `/${locale}/blog/${post.slug}`

**Notes:** Empty state lives in BlogListClient.tsx (filteredPosts.length===0). A missing DATABASE_URL also renders the empty state here (page.tsx catch → []), so treat empty-state as pass regardless of cause.

#### `blog-04` — Post page renders title, meta, breadcrumbs, markdown body and CTA  `P0`

**Preconditions:** One published en post exists. Obtain its slug first: GET http://localhost:3000/api/blog/posts?locale=en and take .posts[0].slug.

**Steps:**
1. GET /api/blog/posts?locale=en and capture a slug
2. Navigate to http://localhost:3000/en/blog/<slug>
3. Inspect the breadcrumb nav, header back-link, article header, body, and the CTA block

**Expected:** A nav labelled 'Breadcrumb' contains a link 'Home' (→/en), a link 'Blog' (→/en/blog) and the post title text. A back link named 'Back to Blog' is present. The article h1 equals the post title. A time/date (e.g. 'January 15, 2026'), a reading-time label like '<n> min read', and an uppercase locale badge 'EN' are shown. The rendered markdown body has visible prose. A CTA section shows heading 'Ready to Start Your Project?' with a link 'Get Started' and a link 'View Our Work'.

**Grounding (selectors/source):** Breadcrumb aria-label='Breadcrumb'; literal 'Home' and 'Blog' crumb links; back link blog.backToBlog 'Back to Blog'; reading time blog.readingTime 'min read'; locale badge post.locale.toUpperCase(); CTA blog.cta.title 'Ready to Start Your Project?', blog.cta.getStarted 'Get Started', blog.cta.viewWork 'View Our Work'

**Notes:** Body is server-rendered via ReactMarkdown; BlogPostClient only fires analytics.

#### `blog-07` — Unknown post slug returns a real 404  `P0`

**Preconditions:** Dev server running; DATABASE_URL set (reachable).

**Steps:**
1. Navigate to http://localhost:3000/en/blog/this-slug-does-not-exist-zzz-999
2. Observe the HTTP status and rendered page

**Expected:** HTTP 404 (not a 200 soft-404). The Next.js not-found UI renders instead of an article. No article h1 / breadcrumb for a real post.

**Grounding (selectors/source):** generateMetadata calls notFound() when getBlogPost returns null (blog/[slug]/page.tsx line 108-114) to force a hard 404 before the shell flushes.

**Notes:** A DB/infra error would instead yield 500 — distinct from this genuine 404. Use a clearly bogus slug so the query succeeds-but-empty.

#### `blog-09` — RSS feed /en/feed.xml is valid RSS 2.0 with correct headers  `P0`

**Preconditions:** DATABASE_URL reachable. Items present only if en posts are published; structure asserted regardless.

**Steps:**
1. Issue GET http://localhost:3000/en/feed.xml (via browser fetch / network request so raw body + headers are visible)
2. Check the response status, Content-Type header, and body

**Expected:** Status 200. Content-Type header 'application/rss+xml; charset=utf-8'. Body starts with '<?xml version="1.0" encoding="UTF-8"?>' and contains '<rss version="2.0"', a <channel> with <title>SoftWhere.uz Blog</title>, <link>http://localhost:3000/en/blog</link> (baseUrl may be the configured NEXT_PUBLIC_BASE_URL, e.g. https://softwhere.uz), <language>en</language>, and an atom:link rel="self" pointing at .../en/feed.xml. When posts exist, each <item> has <title>, <link>, <guid isPermaLink="true">, and <pubDate>.

**Grounding (selectors/source):** route src/app/[locale]/feed.xml/route.ts: CHANNEL_TITLE.en 'SoftWhere.uz Blog'; Content-Type + Cache-Control headers; listForFeed(locale,20)

**Notes:** feed.xml bypasses the intl proxy (matcher excludes dotted paths) and is served directly by the route.

#### `blog-11` — GET /api/blog/posts returns posts array; invalid locale is 400  `P0`

**Preconditions:** DATABASE_URL reachable.

**Steps:**
1. GET http://localhost:3000/api/blog/posts
2. GET http://localhost:3000/api/blog/posts?locale=en
3. GET http://localhost:3000/api/blog/posts?locale=xx

**Expected:** No-param and ?locale=en: status 200, JSON { "posts": [ ... ] } where each item has _id, title, slug, createdAt (ISO string), locale, and optional coverImage/category; ?locale=en only returns locale==='en' items. ?locale=xx: status 400, JSON { "error": "Invalid locale. Allowed: en, ru, uz" }.

**Grounding (selectors/source):** src/app/api/blog/posts/route.ts: isValidLocale gate → 400 body 'Invalid locale. Allowed: en, ru, uz'; success body { posts }; force-dynamic

**Notes:** On DB failure the route returns 500 { "error": "Failed to fetch posts" }; treat that as a DB-env problem, not a contract failure.

#### `blog-14` — POST /api/blog/generate rejects unauthenticated requests with 401  `P0`

**Preconditions:** No admin session cookie and no Authorization header (or a wrong Bearer token).

**Steps:**
1. Send POST http://localhost:3000/api/blog/generate with header Content-Type: application/json and body {"category":"ai-solutions","locales":["en"]} and NO Authorization header
2. Send the same POST with header Authorization: Bearer wrong-secret

**Expected:** Both requests return status 401 with JSON body { "error": "Unauthorized" }. No post is generated and no DB write occurs (requireAdmin short-circuits before body parsing).

**Grounding (selectors/source):** src/app/api/blog/generate/route.ts line 40-41 requireAdmin(request); src/core/auth.ts requireAdmin → NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) when neither a Neon Auth admin session nor a matching Bearer ${API_SECRET} is present

**Notes:** The authorized/success path needs API_SECRET (or a Neon Auth admin session) plus an AI key and up to 300s — out of scope for a secretless run; only the 401 rejection is asserted here.

#### `blog-02` — Blog listing localizes heading and empty-state copy (ru + uz)  `P1`

**Preconditions:** Dev server running. Empty-state assertions require no published posts in that locale; heading assertion works regardless.

**Steps:**
1. Navigate to http://localhost:3000/ru/blog and read the h1 and any empty-state paragraph
2. Navigate to http://localhost:3000/uz/blog and read the h1 and any empty-state paragraph

**Expected:** ru: h1 is 'Блог'; if no ru posts, empty paragraph reads 'В данный момент нет доступных постов.'. uz: h1 is 'Blog'; if no uz posts, empty paragraph reads 'Hozirda blog postlari mavjud emas.'.

**Grounding (selectors/source):** ru blog.title 'Блог' / blog.noPostsAvailable 'В данный момент нет доступных постов.'; uz blog.title 'Blog' / blog.noPostsAvailable 'Hozirda blog postlari mavjud emas.'

**Notes:** Confirms next-intl locale wiring for the blog namespace.

#### `blog-03` — Category filter bar appears with >1 category and filters the grid  `P1`

**Preconditions:** At least 2 published en posts in two DIFFERENT categories (e.g. 'ai-solutions' and 'web-app-development').

**Steps:**
1. Navigate to http://localhost:3000/en/blog
2. Locate the filter buttons above the grid
3. Note the number of cards shown
4. Click a specific category button (e.g. 'AI Solutions')

**Expected:** A row of pill buttons is present: a button named 'All' plus one button per available category using the translated label (e.g. 'AI Solutions', 'Web App Development'). 'All' is active initially and shows every post. After clicking a category, only cards whose category matches remain in the grid.

**Grounding (selectors/source):** 'All' button = blog.allCategories; category labels = blog.categories.* (e.g. blog.categories.ai-solutions 'AI Solutions'). Filter bar only rendered when availableCategories.length > 1 (BlogListClient.tsx line 69).

**Notes:** If only one (or zero) categories are published, the bar is intentionally hidden — that is not a failure.

#### `blog-05` — Related Articles section shows same-category siblings (or is absent)  `P1`

**Preconditions:** For the post under test, >=2 OTHER published posts share its category and locale (getRelatedByCategory returns up to 3).

**Steps:**
1. Open a published en post that has same-category siblings (see preconditions)
2. Scroll below the article CTA
3. Inspect for a related-articles section

**Expected:** A section with heading 'Related Articles' contains up to 3 cards, each a link to /en/blog/<related-slug> showing the related post title. If the post has no same-category siblings, the section is completely absent (RelatedPosts returns null).

**Grounding (selectors/source):** Heading blog.relatedArticles 'Related Articles'; related card links href `/${locale}/blog/${rp.slug}` (blog/[slug]/page.tsx RelatedPosts)

**Notes:** Streamed via <Suspense>; may render slightly after the main article.

#### `blog-06` — Post CTA and footer links point to correct in-site targets  `P1`

**Preconditions:** One published en post (slug obtained as in blog-04).

**Steps:**
1. Open http://localhost:3000/en/blog/<slug>
2. Inspect the href of the 'Get Started' link, the 'View Our Work' link, and the bottom 'Read More Articles' link

**Expected:** 'Get Started' href is /en#contact; 'View Our Work' href is /en#portfolio; the bottom link named 'Read More Articles' href is /en/blog.

**Grounding (selectors/source):** TrackedCTALink href={`/${locale}#contact`} text blog.cta.getStarted; href={`/${locale}#portfolio`} text blog.cta.viewWork; bottom link blog.readMoreArticles 'Read More Articles' href={`/${locale}/blog`}

**Notes:** Locale prefix in the hrefs must match the page locale.

#### `blog-10` — RSS feed channel metadata is localized (ru + uz)  `P1`

**Preconditions:** DATABASE_URL reachable.

**Steps:**
1. GET http://localhost:3000/ru/feed.xml and inspect <title> and <language>
2. GET http://localhost:3000/uz/feed.xml and inspect <title> and <language>

**Expected:** ru feed: <title>Блог SoftWhere.uz</title> and <language>ru</language>. uz feed: <title>SoftWhere.uz blogi</title> and <language>uz</language>. Both are valid RSS 2.0 with an atom:self link to their own /<locale>/feed.xml.

**Grounding (selectors/source):** CHANNEL_TITLE.ru 'Блог SoftWhere.uz', CHANNEL_TITLE.uz 'SoftWhere.uz blogi'; <language>${locale}</language>

**Notes:** An unrecognized locale segment falls back to 'en' (validateLocale) rather than erroring.

#### `blog-12` — GET /api/blog/posts/[slug] returns one post or 404  `P1`

**Preconditions:** One published en post; slug from blog-11.

**Steps:**
1. GET http://localhost:3000/api/blog/posts/<real-slug>?locale=en
2. GET http://localhost:3000/api/blog/posts/definitely-not-a-real-slug-000?locale=en

**Expected:** Real slug: status 200, JSON { "post": { _id, title, slug, content, status:'published', locale, createdAt, updatedAt, ... } }. Unknown slug: status 404, JSON { "error": "Post not found" }.

**Grounding (selectors/source):** src/app/api/blog/posts/[slug]/route.ts: getPublishedBySlug → null → 404 'Post not found'; locale param defaults to 'en' via validateLocale (invalid locale silently falls back, no 400 here)

**Notes:** Unlike the list route, an invalid ?locale does NOT 400 here — it falls back to 'en'.

#### `blog-13` — GET /api/blog/posts/related validation and success shape  `P1`

**Preconditions:** For the success sub-case, a generationGroupId that has a published sibling in the target locale (from an existing multi-locale post group); otherwise only the error paths are exercised.

**Steps:**
1. GET http://localhost:3000/api/blog/posts/related (no params)
2. GET http://localhost:3000/api/blog/posts/related?generationGroupId=abc&locale=xx
3. GET http://localhost:3000/api/blog/posts/related?generationGroupId=<130-char-string>&locale=ru
4. GET http://localhost:3000/api/blog/posts/related?generationGroupId=<unknown-uuid>&locale=ru
5. GET http://localhost:3000/api/blog/posts/related?generationGroupId=<real-group-id>&locale=ru

**Expected:** No params: 400 { "error": "generationGroupId and locale are required" }. Invalid locale: 400 { "error": "Invalid locale. Allowed: en, ru, uz" }. groupId >128 chars: 400 { "error": "Invalid generationGroupId" }. Valid params but no sibling in that locale: 404 { "error": "No related post found in target language" }. Valid with an existing sibling: 200 { "success": true, "post": { "slug": "...", "locale": "ru" } }.

**Grounding (selectors/source):** src/app/api/blog/posts/related/route.ts: MAX_GROUP_ID_LENGTH=128; getPublishedGroupSibling; exact error strings quoted above

**Notes:** Order of checks: required → valid locale → length → lookup. Locale is validated before the length check.

#### `blog-08` — Requesting a post under the wrong locale 308-redirects to its real locale  `P2`

**Preconditions:** A published post whose slug exists ONLY in ru (no en row with that exact slug). Get such a slug via GET /api/blog/posts?locale=ru.

**Steps:**
1. Take a ru-only slug from /api/blog/posts?locale=ru
2. Navigate to http://localhost:3000/en/blog/<ru-slug>
3. Observe the final URL after redirects

**Expected:** A permanent redirect lands on /ru/blog/<ru-slug> (the post's true locale), and the ru article renders.

**Grounding (selectors/source):** getPublishedBySlugFlexible falls back to any-locale slug match; page.tsx line 243-245 permanentRedirect(`/${post.locale}/blog/${encodeURIComponent(post.slug)}`) when post.locale !== locale

**Notes:** Requires slugs to differ across locales (they normally do). If a slug happens to exist in both en and ru, no redirect fires — pick a slug unique to ru.

## Contact form + Admin area + auth (15 cases)

#### `cf-01` — Contact form: empty submit surfaces the phone error first  `P0`

**Preconditions:** Home page loaded at http://localhost:3000/en. No DB/auth needed (validation is client-side and returns before any network call).

**Steps:**
1. Navigate to http://localhost:3000/en
2. Scroll to the 'Contact Us' section (anchor #contact)
3. Without typing anything, click the button named 'Send'

**Expected:** validateForm() checks phone before name, and the uz prefix has only 3 digits (<9), so the PHONE error fires: a toast reading exactly 'Enter phone number!' appears AND an inline alert (role='alert') with text 'Enter phone number!' renders under the phone field; the phone input gets aria-invalid=true. No name/message error yet. No POST /api/contact is sent.

**Grounding (selectors/source):** Section heading 'Contact Us' (contact section, id='contact'). Phone field: textbox labeled 'Your Phone Number' (input id='phone-input', prefilled '+998 ' via defaultCountry='uz'). Submit: button named 'Send'. Inline error: element role='alert' id='phone-error' with text 'Enter phone number!'. Toast text 'Enter phone number!'.

**Notes:** tM('phoneNumber')='Enter phone number!'. Because phone is validated first, the name error cannot be observed on a fully empty form.

#### `cf-04` — Contact form: successful submit shows loading then success toast and clears fields  `P0`

**Preconditions:** DATABASE_URL configured and reachable (createLead must succeed). Home /en loaded. TG creds optional.

**Steps:**
1. Navigate to http://localhost:3000/en, scroll to 'Contact Us'
2. Fill 'Your Phone Number' with '90 123-45-67'
3. Fill 'Your Name' with 'QA Tester'
4. Fill 'Message' with 'This is an automated e2e test lead.'
5. Click 'Send'

**Expected:** A loading toast 'Please wait...' shows immediately, then POST /api/contact returns 200 {success:true} and the toast updates to 'Message sent successfully!' (type success). All three inputs reset to empty and the Send button re-enables. Backend: a lead row is created FIRST (durable), then Telegram is best-effort (notifiedTelegram becomes 'sent' if TG creds set, else stays 'pending'; success is reported regardless).

**Grounding (selectors/source):** Fields 'Your Phone Number', 'Your Name', 'Message'. Button 'Send'. Toasts: 'Please wait...' (loading), then 'Message sent successfully!' (success). On failure: 'Something went wrong'.

**Notes:** send.ts posts {name,phone,message,from:''}; source stored as null. If DB is down the toast becomes 'Something went wrong' instead.

#### `cf-08` — Admin gate: unauthenticated visit to /en/admin/leads renders the login form, not the leads table  `P0`

**Preconditions:** No Neon Auth session cookie present (fresh/incognito). NEON_AUTH_* may be set or unset — either way an unauthenticated request must be denied (fails closed on missing env).

**Steps:**
1. Open a fresh browser context (no cookies)
2. Navigate to http://localhost:3000/en/admin/leads

**Expected:** The URL stays /en/admin/leads (no redirect) and the server layout renders <AdminLogin/> in place: heading 'Admin Access', an email field (placeholder 'you@softwhere.uz'), a password field (placeholder 'Enter password...'), button 'Sign In', and button 'Sign in with Google'. The Leads table / 'Leads' heading must NOT be present. The page is noindex (robots index:false).

**Grounding (selectors/source):** Login heading: heading 'Admin Access' (h2). Email field: textbox with placeholder 'you@softwhere.uz'. Password field: input with placeholder 'Enter password...'. Buttons: 'Sign In' and 'Sign in with Google'. Divider text 'or'. Absent-when-gated: heading 'Leads', text 'contact-form submission(s)', table columns Date/Name/Phone/Message/Source/Notified.

**Notes:** AdminLayout is a server component: `if (!(await isAdminAuthenticated())) return <AdminLogin/>`. Do NOT test bare /en/admin — it 404s (no page.tsx).

#### `cf-10` — Admin API rejects with no session and no Bearer: GET /api/admin/leads -> 401  `P0`

**Preconditions:** No session cookie, no Authorization header.

**Steps:**
1. Send GET /api/admin/leads with no cookies and no Authorization header

**Expected:** HTTP 401 with JSON exactly {"error":"Unauthorized"}. No leads array returned.

**Grounding (selectors/source):** GET http://localhost:3000/api/admin/leads

**Notes:** requireAdmin() returns NextResponse.json({error:'Unauthorized'},{status:401}) when neither the admin session nor Bearer matches.

#### `cf-11` — Admin API accepts Bearer API_SECRET: GET /api/admin/leads -> 200 {leads:[...]}  `P0`

**Preconditions:** API_SECRET env set and known to the test; DATABASE_URL reachable.

**Steps:**
1. Send GET /api/admin/leads with header 'Authorization: Bearer <the exact API_SECRET value>'

**Expected:** HTTP 200 with JSON {"leads": [...]} — an array (newest first, limit 200) of objects shaped {id, name, phone, message|null, source|null, notifiedTelegram: 'pending'|'sent'|'failed', createdAt (ISO string)}. Empty array if no leads.

**Grounding (selectors/source):** GET http://localhost:3000/api/admin/leads with header 'Authorization: Bearer <API_SECRET>'

**Notes:** Exact header check in requireAdmin: `authHeader?.startsWith('Bearer ') && safeEqual(authHeader.slice(7), apiSecret)` (constant-time SHA-256 compare).

#### `cf-02` — Contact form: valid phone + empty name shows name-required error  `P1`

**Preconditions:** Home /en loaded.

**Steps:**
1. Navigate to http://localhost:3000/en and scroll to 'Contact Us'
2. In the 'Your Phone Number' field type a full number so it has >=9 digits, e.g. '90 123-45-67' (becomes +998 90 123-45-67)
3. Leave 'Your Name' empty
4. Click button 'Send'

**Expected:** Phone now passes (>=9 digits), so the NAME check fires: toast text 'Enter your name!' AND inline alert (role='alert', id='name-error') 'Enter your name!' under the name field; name input aria-invalid=true. No network request.

**Grounding (selectors/source):** Phone textbox 'Your Phone Number' (id='phone-input'). Name textbox 'Your Name' (id='name', placeholder 'Your Name'). Button 'Send'. Inline alert id='name-error' text 'Enter your name!'.

**Notes:** tM('name')='Enter your name!'.

#### `cf-05` — /api/contact stores the lead first; HTML-escaping applies only on the Telegram path  `P1`

**Preconditions:** DATABASE_URL configured so createLead succeeds. Telegram behavior depends on TG_BOT_TOKEN+TG_CHAT_ID.

**Steps:**
1. POST http://localhost:3000/api/contact with Content-Type: application/json and body {"name":"Test","phone":"998901234567","message":"hi","from":"e2e"}; expect 200 {"success":true}.
2. POST with body {"phone":"998901234567"} (missing name); expect 400 {"success":false,"error":"Name and phone are required"}.
3. POST >5 times within 60s from the same client; expect a 429 with body {"success":false,"error":"Too many requests. Please try again shortly."} and a Retry-After header.
4. POST a lead whose name contains HTML like '<b>x</b>&' to observe behavior on both configs.

**Expected:** A valid POST returns 200 {success:true} after the lead is durably stored (system of record) regardless of Telegram config. Missing name/phone -> 400 'Name and phone are required'. Exceeding 5 requests/60s/IP -> 429 with Retry-After. Escaping: when TG_BOT_TOKEN+TG_CHAT_ID ARE set, user-controlled fields are HTML-escaped before the parse_mode=html Telegram send; when Telegram creds are ABSENT, the lead is simply stored (source from 'from' sliced to 50 chars) and 200 returned with NO escaping step performed.

**Grounding (selectors/source):** src/app/api/contact/route.ts — rate limit 5/60s per IP (429 with Retry-After); name+phone required (400 'Name and phone are required'); fields sliced to 2000 chars, source ('from') sliced to 50 (route.ts:30); lead is stored FIRST (createLead) and 200 {success:true} is returned; escapeHtml (route.ts:49-56) runs ONLY inside the `if (botToken && chatId)` Telegram block.

**Notes:** CORRECTED (correction #4): draft cf-05 stated user fields are HTML-escaped before send unconditionally. Fixed to scope the escaping claim to the TG-configured path only (route.ts:49-56); with no Telegram creds the lead is stored and 200 returned without any escaping.

#### `cf-06` — API contract: POST /api/contact missing phone returns 400  `P1`

**Preconditions:** DATABASE_URL not required (guard returns before DB write). Fresh rate window.

**Steps:**
1. Send POST /api/contact with 'Content-Type: application/json' and body {"name":"Only Name"} (phone omitted)
2. Also try body {"phone":"+998901234567"} (name omitted)

**Expected:** Both return HTTP 400 with JSON exactly {"success":false,"error":"Name and phone are required"}. No lead is created.

**Grounding (selectors/source):** POST http://localhost:3000/api/contact

**Notes:** Guard: `if (!name || !phone)` -> 400 before createLead.

#### `cf-07` — API rate limit: 6th POST /api/contact within a minute returns 429 + Retry-After  `P1`

**Preconditions:** Single dev instance. Same client IP bucket ('contact:<ip>', likely 'contact:unknown' on localhost). Start a fresh window.

**Steps:**
1. Send 5 rapid POST /api/contact requests with a valid body {"name":"RL","phone":"+998901234567"} (each should be allowed)
2. Send a 6th identical POST within the same 60s window

**Expected:** The first 5 succeed (limit is 5 per 60000ms). The 6th returns HTTP 429 with JSON {"success":false,"error":"Too many requests. Please try again shortly."} and a 'Retry-After' response header whose value is the integer seconds until the window resets.

**Grounding (selectors/source):** POST http://localhost:3000/api/contact

**Notes:** rateLimit(`contact:${ip}`, 5, 60_000). Per-instance/in-memory — reproducible on dev but not a global guarantee.

#### `cf-09` — Admin gate: unauthenticated /en/admin/posts also renders login (same gate, whole section)  `P1`

**Preconditions:** No session cookie.

**Steps:**
1. In a fresh (no-cookie) context navigate to http://localhost:3000/en/admin/posts

**Expected:** Same login screen renders (heading 'Admin Access', 'Sign In' + 'Sign in with Google'). The Posts admin UI ('Content Management' heading, 'Generate New Posts' button) is NOT shown, proving the gate is on the shared admin layout, not per-page.

**Grounding (selectors/source):** heading 'Admin Access'; button 'Sign In'. Absent: heading 'Content Management', button 'Generate New Posts'.

**Notes:** Confirms layout-level protection covers every admin child route.

#### `cf-12` — Admin API: malformed/wrong Bearer still 401; posts create validates fields under Bearer  `P1`

**Preconditions:** API_SECRET set. DATABASE_URL reachable for the 400-validation POST.

**Steps:**
1. Send GET /api/admin/posts with header 'Authorization: Bearer wrong-secret' (expect reject)
2. Send GET /api/admin/posts with header 'Authorization: Basic <API_SECRET>' (wrong scheme, expect reject)
3. Send POST /api/admin/posts with a CORRECT 'Authorization: Bearer <API_SECRET>' and body {"title":"x"} (missing fields)
4. Send GET /api/admin/posts/abc with correct Bearer (invalid id)

**Expected:** Steps 1 and 2 return HTTP 401 {"error":"Unauthorized"} (wrong token and non-'Bearer ' prefix both fail). Step 3 (authorized but incomplete) returns HTTP 400 {"error":"Missing required fields (title, slug, content, status, locale)"}. Step 4 returns HTTP 400 {"error":"Invalid post ID"}. Also valid-shape negatives: bad status -> {"error":"Invalid status value"}; bad locale -> {"error":"Invalid locale value"}.

**Grounding (selectors/source):** POST http://localhost:3000/api/admin/posts ; GET http://localhost:3000/api/admin/posts/abc

**Notes:** Proves auth is enforced (401) separately from payload validation (400), and that only the exact 'Bearer ' scheme + secret is accepted.

#### `cf-13` — Admin API: POST /api/admin/revalidate requires auth, 200 under Bearer  `P1`

**Preconditions:** API_SECRET set.

**Steps:**
1. Send POST /api/admin/revalidate with no auth
2. Send POST /api/admin/revalidate with header 'Authorization: Bearer <API_SECRET>'

**Expected:** Unauthenticated call -> HTTP 401 {"error":"Unauthorized"}. Authorized call -> HTTP 200 {"success":true} (revalidates blog-posts tag, blog list/detail paths, feed.xml per locale, sitemap.xml).

**Grounding (selectors/source):** POST http://localhost:3000/api/admin/revalidate

**Notes:** Same requireAdmin() guard as the other admin routes.

#### `cf-14` — Estimator page renders and advances via the correct heading and button labels  `P1`

**Preconditions:** Dev server running.

**Steps:**
1. Navigate to http://localhost:3000/en/estimator.
2. Assert the on-page eyebrow text 'Project estimator' and the h1 'What will it cost to build?' are visible.
3. Assert the primary advance button is named 'Next →' (with trailing arrow) on non-final steps.
4. Advance to the final (Details) step and assert the advance button becomes 'See estimate →'.
5. On a mobile viewport, assert the back control is an icon button with aria-label 'Back' (not a text 'Back' button).

**Expected:** The estimator is located by the visible h1 'What will it cost to build?' (with eyebrow 'Project estimator'). The advance button reads 'Next →' and, on the last step, 'See estimate →'; the mobile back control has aria-label 'Back'. 'Project Estimator' appears only in the browser tab/OG title, not as any on-page heading.

**Grounding (selectors/source):** Wizard.tsx:222-223 — visible eyebrow t('eyebrow')='Project estimator' and h1 t('headline')='What will it cost to build?'. Advance buttons carry a trailing arrow: 'Next →' and 'See estimate →' (Wizard.tsx:306); mobile back is an icon '←' with aria-label 'Back' (Wizard.tsx:339). The string 'Project Estimator' (estimator.title) is ONLY the metadata <title>/OG (estimator/page.tsx:11), never a visible heading.

**Notes:** CORRECTED (correction #1 and #2): draft cf-14 located the page by a non-existent visible heading 'Project Estimator' and used bare button labels 'Next'/'See estimate'. Fixed to the real h1 'What will it cost to build?', eyebrow 'Project estimator', and the trailing-arrow button labels + aria-label 'Back'.

#### `cf-15` — API contract: POST /api/estimate/lead negative/edge cases (400/413/429)  `P1`

**Preconditions:** Fresh rate window (bucket key 'estimate-lead:<ip>', 5 per 60s).

**Steps:**
1. Send POST with body {"name":"","phone":"123","input":{}} (empty name / short phone)
2. Send POST with a non-JSON body like 'not json' and Content-Type application/json
3. Send POST with a valid name+phone but no/invalid 'input' (e.g. {"name":"A","phone":"+998901234567"})
4. Send POST with a body larger than 32 KB (e.g. a 40 KB 'comment')
5. Send 6 valid-shaped requests within 60s

**Expected:** Missing name or <9 phone digits -> HTTP 400 {"success":false,"error":"Name and phone are required"}. Non-JSON body -> HTTP 400 {"success":false,"error":"Invalid JSON body"}. Missing/invalid estimator input -> HTTP 400 {"success":false,"error":"Invalid estimator input"}. Body > 32768 bytes -> HTTP 413 {"success":false,"error":"Request body too large"}. 6th within window -> HTTP 429 {"success":false,"error":"Too many requests. Please try again shortly."} + 'Retry-After' header.

**Grounding (selectors/source):** POST http://localhost:3000/api/estimate/lead

**Notes:** A fully valid 200 requires a well-formed sanitizeEstimatorInput() object; that happy path is covered end-to-end by the UI cross-flow cf-14. Numbers in the echoed 'ai' block are re-validated and clamped server-side, so client-planted values can't reach the notification.

#### `cf-03` — Contact form: valid phone+name but empty message blocks submit (client-only rule)  `P2`

**Preconditions:** Home /en loaded.

**Steps:**
1. Navigate to http://localhost:3000/en, scroll to 'Contact Us'
2. Fill 'Your Phone Number' with a full number (>=9 digits)
3. Fill 'Your Name' with 'QA Tester'
4. Leave the 'Message' textarea empty
5. Click 'Send'

**Expected:** Toast text 'Enter message!' appears and submission is blocked. Note: message is enforced ONLY client-side — the message textarea has no inline role='alert' element, so assert on the toast only. (The /api/contact route itself does NOT require a message.)

**Grounding (selectors/source):** Message textbox labeled 'Message' (id='message', placeholder 'Enter your message here...'). Button 'Send'. Toast text 'Enter message!'.

**Notes:** tM('message')='Enter message!'. This asserts the divergence between client (message required) and API (only name+phone required).

## i18n integrity, SEO metadata, and infra/SEO endpoints (softwhere.uz) (13 cases)

#### `health-01` — /api/health returns healthy JSON with a timestamp  `P0`

**Preconditions:** Dev server on :3000. No DB required — this endpoint does not touch the database.

**Steps:**
1. browser_evaluate: fetch('/api/health').then(r=>Promise.all([r.status, r.json()])) — expect status 200.
2. Assert response body .status === 'healthy' and .timestamp is a non-empty ISO 8601 string (matches /\d{4}-\d{2}-\d{2}T/).

**Expected:** HTTP 200, JSON { status: 'healthy', timestamp: <ISO string> }. Always healthy (no dependencies).

**Grounding (selectors/source):** src/app/api/health/route.ts:3-8 — GET returns NextResponse.json({ status:'healthy', timestamp: new Date().toISOString() }).

#### `i18n-01` — Home page renders fully translated in all three locales with correct <html lang> and no next-intl fallback artifacts  `P0`

**Preconditions:** Dev server on :3000. No DB needed (home page is static content only).

**Steps:**
1. Navigate to http://localhost:3000/en and wait for load.
2. Run browser_evaluate: document.documentElement.lang — expect 'en'.
3. Assert the visible text 'Product studio · Tashkent' appears (hero eyebrow), a nav link named 'Services' exists, and footer text '© 2026 Softwhere. All rights reserved.' appears.
4. Run browser_evaluate returning document.body.innerText and assert it contains NO raw next-intl key tokens: the substrings 'hero.eyebrow', 'header.services', 'estimator.', 'metadata.title' must NOT appear as visible text, and no Next.js error overlay is present.
5. Navigate to http://localhost:3000/ru; assert document.documentElement.lang === 'ru'; assert 'Продуктовая студия · Ташкент', nav link 'Услуги', and footer '© 2026 Softwhere. Все права защищены.' appear.
6. Navigate to http://localhost:3000/uz; assert document.documentElement.lang === 'uz'; assert 'Mahsulot studiyasi · Toshkent', nav link 'Xizmatlar', and footer '© 2026 Softwhere. Barcha huquqlar himoyalangan.' appear.

**Expected:** Each locale sets <html lang> to exactly that locale code. Each locale shows its own translated hero eyebrow, header nav, and footer copyright. No dotted message-key path is ever visible as text and no error overlay renders — confirming next-intl found every message (fallback would surface the literal key path like 'hero.eyebrow').

**Grounding (selectors/source):** src/app/[locale]/layout.tsx:134 `<html lang={locale} ...>`; Hero eyebrow div renders t('eyebrow') (Hero/index.tsx:22); Header nav links render t('services'), t('work'), t('blog'), t('estimate') (Header/index.tsx:225-237); Footer renders t('rights') (Footer/index.tsx:96). en: hero.eyebrow='Product studio · Tashkent', header.services='Services', footer.rights='© 2026 Softwhere. All rights reserved.'; ru: 'Продуктовая студия · Ташкент', 'Услуги', '© 2026 Softwhere. Все права защищены.'; uz: 'Mahsulot studiyasi · Toshkent', 'Xizmatlar', '© 2026 Softwhere. Barcha huquqlar himoyalangan.'

**Notes:** next-intl's default getMessageFallback renders the namespaced key path (e.g. 'hero.eyebrow') when a message is missing — that dotted token is the tell an accessibility-tree agent uses to spot a missing translation. Parity was verified so none should appear.

#### `notfound-01` — Unknown path under a valid locale (/en/nonexistent) serves the 404 not-found page  `P0`

**Preconditions:** Dev server on :3000.

**Steps:**
1. browser_evaluate: fetch('/en/nonexistent').then(r=>r.status) — expect 404.
2. Navigate to http://localhost:3000/en/nonexistent.
3. Assert visible heading '404' and text 'Page not found' are present.
4. Assert a link named 'Go to homepage' exists and its href resolves to '/'.
5. browser_evaluate: document.documentElement.lang — expect 'en'.

**Expected:** HTTP 404. The rendered page shows '404', 'Page not found', and a 'Go to homepage' link to '/', inside an <html lang='en'> document. It must be a real 404 status, not a soft-404 (status 200).

**Grounding (selectors/source):** src/app/not-found.tsx — renders its own <html lang='en'> document with <h1>404</h1>, <p>Page not found</p>, and a Link 'Go to homepage' → href '/'. (Root layout is a passthrough, so this global not-found supplies the full document.)

**Notes:** There is no [locale]/not-found.tsx, so all unmatched routes fall through to the single global src/app/not-found.tsx.

#### `robots-01` — /robots.txt is reachable with correct allow/disallow rules and sitemap pointer  `P0`

**Preconditions:** Dev server on :3000.

**Steps:**
1. browser_evaluate: fetch('/robots.txt').then(r=>Promise.all([r.status, r.headers.get('content-type'), r.text()])).
2. Expect status 200 and content-type containing 'text/plain'.
3. Assert the body text contains 'User-Agent: *', 'Allow: /', 'Allow: /api/og', 'Disallow: /admin/', 'Disallow: /*/admin/', 'Disallow: /api/', 'Disallow: /_next/', and a 'Sitemap:' line ending in '/sitemap.xml'.

**Expected:** 200 text/plain robots file that allows / and /api/og, disallows both /admin/ and /*/admin/ (locale-prefixed admin), /api/, and /_next/, and points Sitemap at ${BASE_URL}/sitemap.xml (host defaults to https://softwhere.uz locally).

**Grounding (selectors/source):** src/app/robots.ts — userAgent '*'; allow ['/', '/api/og']; disallow ['/admin/', '/*/admin/', '/api/', '/_next/']; sitemap `${BASE_URL}/sitemap.xml`.

**Notes:** /api/og is deliberately allowed even though /api/ is disallowed, because og:image and JSON-LD reference it (robots.ts:8-9).

#### `seo-02` — Home page emits canonical, hreflang alternates, and OpenGraph/Twitter meta per locale  `P0`

**Preconditions:** Dev server on :3000. BASE_URL host is https://softwhere.uz unless NEXT_PUBLIC_BASE_URL overrides.

**Steps:**
1. Navigate to http://localhost:3000/en.
2. browser_evaluate: document.querySelector('link[rel=canonical]').href — expect it to end with '/en'.
3. browser_evaluate: Array.from(document.querySelectorAll('link[rel=alternate][hreflang]')).map(l=>[l.hreflang,l.href]) — expect entries for hreflang 'x-default' (href ends '/uz'), 'uz' (ends '/uz'), 'ru' (ends '/ru'), 'en' (ends '/en').
4. browser_evaluate: document.querySelector('meta[property="og:site_name"]').content — expect 'SoftWhere.uz'; og:type === 'website'; og:locale === 'en'; og:url ends with '/en'; og:title equals metadata title starting 'Build Your Dream Mobile App'.
5. browser_evaluate: document.querySelector('meta[property="og:image"]').content — expect it to contain '/api/og?title=' and 'locale=en'.
6. browser_evaluate: document.querySelector('meta[name="twitter:card"]').content — expect 'summary_large_image'.
7. Navigate to http://localhost:3000/ru and assert canonical ends '/ru' and og:locale === 'ru'.

**Expected:** Canonical points at the same-locale localized home. Exactly four hreflang alternates are present (x-default→/uz plus uz/ru/en). OG has siteName 'SoftWhere.uz', type 'website', locale matching the URL, an og:image pointing at the /api/og route with the right locale param, and twitter:card 'summary_large_image'. x-default resolves to the /uz root (DEFAULT_LOCALE='uz').

**Grounding (selectors/source):** generateMetadata in src/app/[locale]/layout.tsx:36-77 — alternates.canonical=`${BASE_URL}/${locale}`; alternates.languages = {x-default:`${BASE_URL}/uz`, uz:`/uz`, ru:`/ru`, en:`/en`}; openGraph.siteName='SoftWhere.uz', type='website', url=`${BASE_URL}/${locale}`, images[0].url=`${BASE_URL}/api/og?title=...&locale=${locale}`; twitter.card='summary_large_image'. metadata.title (en)='Build Your Dream Mobile App, Website or Telegram Bot - Up to 50% Off + Free Hosting'.

**Notes:** Meta tags live in <head>, invisible to the accessibility tree — the agent must use browser_evaluate to read them.

#### `sitemap-01` — /sitemap.xml is reachable and lists localized home/blog/estimator URLs with no bare-root entry  `P0`

**Preconditions:** Dev server on :3000. Blog-post <url> entries additionally require a reachable DB, but static entries always render (falls back to static-only on DB error, sitemap.ts:89-92).

**Steps:**
1. browser_evaluate: fetch('/sitemap.xml').then(r=>Promise.all([r.status, r.headers.get('content-type'), r.text()])).
2. Expect status 200 and content-type containing 'xml'.
3. Assert the XML contains <loc> entries ending in '/uz', '/ru', '/en', '/uz/blog', '/ru/blog', '/en/blog', '/uz/estimator', '/ru/estimator', '/en/estimator'.
4. Assert there is NO <loc> equal to the bare host root (e.g. no '<loc>https://softwhere.uz</loc>' without a trailing locale segment).
5. Assert hreflang alternates are present (xhtml:link rel='alternate' hreflang='x-default'/'uz'/'ru'/'en').

**Expected:** 200 XML urlset containing the 9 localized static URLs (3 locales × home/blog/estimator) with hreflang alternates; the redirecting bare root is intentionally excluded. If the DB is up, additional /{locale}/blog/{slug} post entries appear; if the DB errors, the sitemap still serves the static-only set (never 500s).

**Grounding (selectors/source):** src/app/sitemap.ts — staticPages ['', '/blog', '/estimator'] × locales ['uz','ru','en'] → 9 <url> entries; home priority 1.0, others 0.8; each has xhtml hreflang alternates (x-default→/uz plus uz/ru/en). No entry for the bare `${BASE_URL}` root (comment sitemap.ts:14).

#### `blog-meta-01` — Blog post page emits article OG, canonical, hreflang, and correct index/noindex robots  `P1`

**Preconditions:** Requires DB with at least one PUBLISHED post so /{locale}/blog lists it. Cannot run without seeded data.

**Steps:**
1. Navigate to http://localhost:3000/en/blog and confirm at least one post card is present (blog list). If 'No posts available at the moment.' shows, skip — no seeded data.
2. Click the first post link to open its detail page.
3. browser_evaluate: document.querySelector('meta[property="og:type"]').content — expect 'article'.
4. browser_evaluate: document.querySelector('link[rel=canonical]').href — expect it to contain '/blog/' and end with the post slug.
5. browser_evaluate: document.querySelector('meta[property="og:image"]').content — expect it to contain '/api/og?title=' and 'locale='.
6. browser_evaluate: document.title — expect it to end with ' | SoftWhere.uz Blog'.
7. browser_evaluate: read the robots meta (document.querySelector('meta[name="robots"]')?.content) — for a directly-opened canonical post in its own locale expect it to allow indexing (contains 'index'), not 'noindex'.
8. Also assert a visible <h1> matching the post title renders (page.tsx:336) and a UZ/RU/EN language badge (post.locale.toUpperCase(), page.tsx:363) is shown.

**Expected:** og:type 'article', canonical pointing at the canonical-slug post URL, og:image via /api/og with the post locale, document.title ending ' | SoftWhere.uz Blog', and robots that index only the canonical variant in its own locale (noindex,follow for duplicate/mismatched-locale variants). Opening a slug whose post.locale differs from the URL locale 308-permanent-redirects to the correct locale (page.tsx:243-245).

**Grounding (selectors/source):** generateMetadata in src/app/[locale]/blog/[slug]/page.tsx:93-184 — title `${post.title} | SoftWhere.uz Blog`; openGraph.type 'article' with publishedTime/modifiedTime and images pointing at `${BASE_URL}/api/og?title=...&locale=${post.locale}` (+ &image=... when coverImage exists); twitter.card 'summary_large_image'; alternates.canonical=`${BASE_URL}/${post.locale}/blog/${canonicalSlug}`; robots = {index:true,follow:true} ONLY when the requested slug is the canonical variant AND post.locale===requested locale, else {index:false,follow:true} (line 178).

**Notes:** Robots index/noindex logic (page.tsx:178) is the key correctness assertion but needs multiple seeded variants to fully exercise; the base case just confirms a canonical post is indexable.

#### `currency-01` — /api/currency/rates returns {base, rates} shape (and caches in-memory, not via response headers)  `P1`

**Preconditions:** Needs outbound access to open.er-api.com (or EXCHANGERATE_API_KEY set for the paid host).

**Steps:**
1. browser_evaluate: fetch('/api/currency/rates').then(r=>Promise.all([r.status, r.headers.get('cache-control'), r.json()])).
2. On success expect status 200; body .base === 'USD'; body .rates is an object; typeof body.rates.USD === 'number' (≈1) and body.rates.UZS is a number (> 1000).
3. Assert the response Cache-Control header is null/absent — caching is server-side (in-memory 24h + upstream next.revalidate 86400), NOT a response header.
4. Negative: if outbound network is blocked, expect a 502 with {error:'Failed to fetch rates'} or {error:'Invalid response'}, or 500 {error:'Failed to fetch rates'} — never a 200 with empty rates (the code refuses to cache an empty set).

**Expected:** Success: 200 { base:'USD', rates:{...currencyCode:number} } including USD and UZS numeric entries, with NO Cache-Control response header. Failure: a 5xx with an { error } body and no rates — the handler never quotes an empty/1:1 rate set.

**Grounding (selectors/source):** src/app/api/currency/rates/route.ts — success returns NextResponse.json({ base, rates }); base normalized from base_code||base (default 'USD'); rates from conversion_rates||rates. Failure paths: upstream !ok → 502 {error:'Failed to fetch rates'}; result==='error' or empty rates → 502 {error:'Invalid response'}; thrown → 500 {error:'Failed to fetch rates'}. CACHE_MS = 24h in-memory module cache (route.ts:4). No Cache-Control header is set on the JSON response.

**Notes:** The task hypothesis of 'caching headers' does not hold for THIS route: the handler sets none; caching is the in-memory cachedRates guard plus fetch revalidate. Consumed by src/modules/estimator/components/CurrencySwitcher.tsx:32.

#### `feed-01` — Per-locale RSS feed /{locale}/feed.xml returns RSS 2.0 with locale-specific channel and cache header  `P1`

**Preconditions:** Dev server on :3000. <item>s require a reachable DB with published posts; an empty channel still renders 200. DB throw → 500.

**Steps:**
1. browser_evaluate: fetch('/en/feed.xml').then(r=>Promise.all([r.status, r.headers.get('content-type'), r.headers.get('cache-control'), r.text()])).
2. Expect status 200; content-type 'application/rss+xml; charset=utf-8'; cache-control 'public, s-maxage=3600, stale-while-revalidate=86400'.
3. Assert body contains '<rss version="2.0"', '<title>SoftWhere.uz Blog</title>', and '<language>en</language>'.
4. Repeat for '/ru/feed.xml' (title 'Блог SoftWhere.uz', <language>ru</language>) and '/uz/feed.xml' (title 'SoftWhere.uz blogi', <language>uz</language>).

**Expected:** Each locale returns a valid RSS 2.0 document (200) with the locale-specific channel title/description/language and the documented Cache-Control. With DB posts, <item> blocks with <title>/<link>/<guid>/<pubDate> appear; without posts the channel is valid but item-less. A DB error yields 500 'Feed unavailable'.

**Grounding (selectors/source):** src/app/[locale]/feed.xml/route.ts — Content-Type 'application/rss+xml; charset=utf-8'; Cache-Control 'public, s-maxage=3600, stale-while-revalidate=86400'; channel <title> per locale: en 'SoftWhere.uz Blog', ru 'Блог SoftWhere.uz', uz 'SoftWhere.uz blogi'; <language>{locale}</language>; atom:link self = `${BASE_URL}/${locale}/feed.xml`. On error → 500 'Feed unavailable'.

**Notes:** validateLocale falls back to 'en' for unknown locale segments.

#### `health-02` — /api/health/db reports DB reachability (healthy 200 vs unhealthy 503)  `P1`

**Preconditions:** Behavior depends on DATABASE_URL / Neon reachability.

**Steps:**
1. browser_evaluate: fetch('/api/health/db').then(r=>Promise.all([r.status, r.json()])).
2. If DATABASE_URL is configured and Neon is reachable: expect status 200, body .status === 'healthy', and .duration a string ending in 'ms'.
3. If the DB is unreachable/unset: expect status 503 and body { status: 'unhealthy' } (no duration field).

**Expected:** Exactly one of: 200 {status:'healthy', duration:'<n>ms'} when the DB pings, or 503 {status:'unhealthy'} when pingDb() throws. Record which branch ran given the env.

**Grounding (selectors/source):** src/app/api/health/db/route.ts — on pingDb() success returns 200 { status:'healthy', duration:`${ms}ms` }; on throw returns NextResponse.json({ status:'unhealthy' }, { status: 503 }).

**Notes:** Requires DATABASE_URL to exercise the healthy branch — see envNotes.

#### `og-01` — /api/og returns a 1200x630 PNG image for Latin and Cyrillic titles  `P1`

**Preconditions:** Dev server on :3000. Outbound access to fonts.googleapis.com preferred but not required (graceful fallback).

**Steps:**
1. browser_evaluate an async fetch: fetch('/api/og?title=Hello%20World&locale=en').then(r=>({status:r.status, ct:r.headers.get('content-type')})) — expect status 200 and content-type starting 'image/png'.
2. Repeat with a Cyrillic title: fetch('/api/og?title=' + encodeURIComponent('Разработка приложений') + '&locale=ru') — expect status 200, content-type 'image/png'.
3. Optionally read Cache-Control header and assert it is one of the two documented values (contains 'max-age=31536000' when fonts loaded, else 'max-age=3600').

**Expected:** Both requests return HTTP 200 with content-type image/png. The endpoint never 500s for well-formed input; the SSRF-guarded image param (only images.unsplash.com allowed, route.tsx:38-49) is not exercised here. Cache-Control is long/immutable only when the real font embedded, short (3600) on font-fetch failure.

**Grounding (selectors/source):** src/app/api/og/route.tsx — runtime='edge'; returns ImageResponse width 1200 height 630; Cache-Control is 'public, immutable, no-transform, max-age=31536000' when the font subset loaded, else 'public, max-age=3600' (route.tsx:163); on caught error returns 500 'Failed to generate image'.

**Notes:** Edge route; the Cyrillic case validates the Noto Sans subset avoids tofu. Do not assert exact bytes — only status + content-type.

#### `seo-03` — Home page includes Organization + WebSite JSON-LD structured data  `P1`

**Preconditions:** Dev server on :3000.

**Steps:**
1. Navigate to http://localhost:3000/en.
2. browser_evaluate: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s=>JSON.parse(s.textContent)['@type']) — expect ['Organization','WebSite'].
3. browser_evaluate: parse the Organization script and assert .name === 'SoftWhere.uz' and .contactPoint.telephone === '+998332499111'.

**Expected:** Two valid JSON-LD scripts are present and parse without error; one is @type Organization with name 'SoftWhere.uz' and telephone '+998332499111', the other @type WebSite. safeJsonLd output must be valid JSON (no unescaped breakouts).

**Grounding (selectors/source):** StructuredData() in src/app/[locale]/layout.tsx:79-112 injects two <script type='application/ld+json'> blocks: @type 'Organization' (name 'SoftWhere.uz', url, logo, contactPoint.telephone '+998332499111', availableLanguage ['Uzbek','Russian','English'], sameAs Telegram+Instagram) and @type 'WebSite' (inLanguage [locale,'uz','ru','en']). Serialized via safeJsonLd().

#### `notfound-02` — Invalid locale segment (/fr) 404s via the layout hasLocale guard  `P2`

**Preconditions:** Dev server on :3000.

**Steps:**
1. browser_evaluate: fetch('/fr').then(r=>r.status) — expect 404.
2. Navigate to http://localhost:3000/fr and assert the '404' / 'Page not found' not-found UI renders (same page as notfound-01).

**Expected:** HTTP 404 for any locale segment outside {en,ru,uz}; the global not-found page renders. Confirms the layout's runtime locale guard rejects unknown locales even though dynamicParams stays enabled for nested blog ISR routes.

**Grounding (selectors/source):** src/app/[locale]/layout.tsx:124-126 — if (!hasLocale(['en','ru','uz'], locale)) notFound(). Only 'en'/'ru'/'uz' are valid (generateStaticParams line 32).

**Notes:** Complements notfound-01: this validates the locale guard specifically, that one validates arbitrary sub-paths under a valid locale.

## Cross-cutting & gap additions from the coverage critic (14 cases)

#### `api-post-01` — /api/admin/posts/[id]: no-auth 401 across GET/PUT/PATCH/DELETE + Bearer validation 400s  `P0`

**Preconditions:** No admin session cookie. For the Bearer steps, API_SECRET must be set; for publish/delete happy-paths also DATABASE_URL + a real seeded post UUID.

**Steps:**
1. Send GET http://localhost:3000/api/admin/posts/00000000-0000-4000-8000-000000000000 with NO auth. Record status+body.
2. Repeat with PUT (JSON body {}), PATCH (JSON body {"status":"published"}), and DELETE — all with NO auth.
3. With header Authorization: Bearer <API_SECRET>, send GET /api/admin/posts/not-a-valid-id.
4. With Bearer, send PATCH /api/admin/posts/00000000-0000-4000-8000-000000000000 body {} (empty).
5. With Bearer, send PATCH /api/admin/posts/00000000-0000-4000-8000-000000000000 body {"status":"bogus"}.
6. (Env-gated, only if API_SECRET+DATABASE_URL+real id) With Bearer, PATCH a real post id with {"status":"published"}; then DELETE a disposable real post id.

**Expected:** All four no-auth verbs return 401 with body {"error":"Unauthorized"}. Bearer GET on 'not-a-valid-id' returns 400 {"error":"Invalid post ID"} (fails isValidPostId before any DB call). Bearer PATCH with empty body returns 400 {"error":"No valid fields to update"}. Bearer PATCH {"status":"bogus"} returns 400 {"error":"Invalid status value"}. Env-gated: valid PATCH {"status":"published"} returns 200 {success:true, post:{...status:'published'}} (and triggers IndexNow); DELETE of a real id returns 200 {"success":true,"message":"Post deleted successfully"}.

**Grounding (selectors/source):** src/app/api/admin/posts/[id]/route.ts — every verb calls requireAdmin() first (auth.ts:47-61 returns NextResponse.json({error:'Unauthorized'},{status:401})). isValidPostId uses a UUID regex (posts.repository.ts:11).

**Notes:** New case (gap #4) — extends the draft's cf-12 (which only covered Bearer GET invalid-id 400). The 401 verbs and the two Bearer PATCH 400s need no DB.

#### `adm-edit-01` — Admin gate: /[locale]/admin/posts/edit/[postId] renders AdminLogin when unauthenticated  `P1`

**Preconditions:** Not signed in as an admin.

**Steps:**
1. Navigate to http://localhost:3000/en/admin/posts/edit/any-id-123 while unauthenticated.
2. Take an accessibility snapshot.

**Expected:** The AdminLogin card renders: heading 'Admin Access' plus the 'Email'/'Password' fields and 'Sign In' button. The editor UI ('Edit Post' h1, 'Save Changes' button, 'Loading post...' spinner) is NOT shown, because the server layout returns AdminLogin before the editor page runs.

**Grounding (selectors/source):** Shared admin layout gate (layout.tsx:17-19) short-circuits BEFORE the EditPostPage client component mounts, so no /api/admin/posts/{id} fetch fires. AdminLogin heading is 'Admin Access'.

**Notes:** New case (gap #3). Confirms the gate is on the layout, not per-page, so even the dynamic [postId] editor is protected without hitting the API.

#### `adm-new-01` — Admin gate: /[locale]/admin/posts/new renders AdminLogin when unauthenticated  `P1`

**Preconditions:** Not signed in as an admin (no Neon Auth admin-role session cookie).

**Steps:**
1. Navigate to http://localhost:3000/en/admin/posts/new while unauthenticated.
2. Take an accessibility snapshot.

**Expected:** The page shows the AdminLogin card, NOT the 'Create New Post' editor: heading with text 'Admin Access' is present; an 'Email' field, a 'Password' field, a button named 'Sign In', and a button named 'Sign in with Google' are present. The 'Create New Post' h1 and the 'Title *' / 'Content (Markdown) *' form fields are NOT rendered.

**Grounding (selectors/source):** Gate lives on the shared admin layout src/app/[locale]/admin/layout.tsx:17-19 (returns <AdminLogin/> when !isAdminAuthenticated()). AdminLogin renders heading 'Admin Access' (h2), inputs labelled 'Email' and 'Password', button named 'Sign In', and a 'Sign in with Google' button.

**Notes:** New case (gap #2). Same gate mechanism as the existing cf-09 admin-layout case, applied to the /new page.

#### `api-gen-02` — /api/blog/generate: authorized-but-invalid-body 400s (no AI key needed)  `P1`

**Preconditions:** API_SECRET set so Bearer auth passes. No AI key or DB required — validation short-circuits at route.ts:49-58.

**Steps:**
1. Send POST http://localhost:3000/api/blog/generate with header Authorization: Bearer <API_SECRET>, Content-Type: application/json, body {"customTopic":"<a 201-character string>"}. Record status+body.
2. Send POST with Bearer and body {"sourceText":"<a 5001-character string>"}. Record status+body.
3. (Control) Send the same POST WITHOUT the Bearer header to confirm auth runs first.

**Expected:** customTopic over 200 chars returns 400 with body {"error":"customTopic must be a string of 200 characters or fewer"}. sourceText over 5000 chars returns 400 with {"error":"sourceText must be a string of 5000 characters or fewer"}. The no-auth control returns 401 {"error":"Unauthorized"}. None of these reach the AI/generation path, so they pass with no MOONSHOT_API_KEY/DEEPSEEK_API_KEY configured.

**Grounding (selectors/source):** src/app/api/blog/generate/route.ts — POST calls requireAdmin() then validates customTopic (MAX_CUSTOM_TOPIC_LENGTH=200) and sourceText (MAX_SOURCE_TEXT_LENGTH=5000) BEFORE any AI/DB work.

**Notes:** New case (gap #5). Complements the draft's existing 401-only coverage of this route with the two length-limit 400s that are testable under Bearer without an AI key.

#### `ce-01` — No error-level browser console messages on key routes  `P1`

**Preconditions:** Dev server running. Blog-post step needs a seeded published post; if none exists, skip that sub-step and note it.

**Steps:**
1. Navigate to http://localhost:3000/en, wait for load, call browser_console_messages, assert no error-level entries.
2. Navigate to http://localhost:3000/en/estimator (assert the 'What will it cost to build?' heading is present to confirm load), then re-check console for errors.
3. Navigate to http://localhost:3000/en/blog, wait for the 'Blog' heading, re-check console.
4. Navigate to a real /en/blog/<slug> post (skip if DB unseeded), wait for the post h1, re-check console.
5. Navigate to http://localhost:3000/en/admin/leads (renders the 'Admin Access' login when unauthenticated), re-check console.

**Expected:** On each route, browser_console_messages contains ZERO error-level messages after load. (Warnings/logs are allowed; only 'error' level fails the case.) Known-acceptable: none expected — treat any React hydration error, failed asset, or thrown exception as a failure and record the message text.

**Grounding (selectors/source):** Use browser_console_messages after each navigation and filter for level === 'error'.

**Notes:** New case (gap #6) — covers all key routes in one parametrized pass; may be split into one case per route if desired.

#### `est-kbd-01` — Estimator wizard is fully keyboard-operable  `P1`

**Preconditions:** Desktop viewport (>=1024px) so the left step rail and the '← Back'/'Next →' footer buttons are visible.

**Steps:**
1. Navigate to http://localhost:3000/en/estimator.
2. On the Type step, Tab to a project-type card (button with aria-pressed) and press Enter (or Space); confirm its aria-pressed flips to true.
3. Press Tab to the 'Next →' button and press Enter to advance to the Scope step.
4. On Scope, Tab to the 'iOS' and 'Android' platform cards (aria-pressed buttons) and toggle one with Space; confirm aria-pressed changes and at least one platform stays selected.
5. Tab to the range input (id='screens', aria-label 'Screens / pages'), press ArrowRight several times then ArrowLeft; confirm the numeric readout beside it changes accordingly.
6. Advance through Features/Integrations (ToggleChip aria-pressed buttons togglable via Space) and to Details (SegmentedPill aria-pressed buttons under 'Timeline'/'Interface languages' togglable via Enter).
7. Tab to a left-rail step button and press Enter; confirm the wizard jumps to that step (its aria-current becomes true).
8. Tab to '← Back' and press Enter; confirm it moves one step back.

**Expected:** Every SelectCard/ToggleChip/SegmentedPill can be focused via Tab and toggled with Enter or Space, reflected by aria-pressed true/false. Arrow keys on #screens increment/decrement the screens value and the readout updates. Rail buttons are reachable by Tab and activate on Enter (jumping steps, aria-current updates). 'Next →', 'See estimate →' and '← Back' are all keyboard-activatable. No control requires a mouse.

**Grounding (selectors/source):** SelectCard, ToggleChip and SegmentedPill all render <button type='button' aria-pressed={selected}> (ui.tsx:34,75,105) — Enter/Space toggle them. Screens control is <input id='screens' type='range' aria-label='Screens / pages'> (ScopeStep.tsx:93-101). Rail items are <button aria-current> (Wizard.tsx:235-256). Footer: 'Next →' / 'See estimate →' (Wizard.tsx:306) and '← Back' (Wizard.tsx:296).

**Notes:** New case (gap #7). All interactive estimator controls are native <button>/<input>, so standard Enter/Space/Arrow semantics apply.

#### `mob-contact-01` — Mobile viewport: contact form validation and submit  `P1`

**Preconditions:** 390x844 viewport. Client-side validation needs no backend; an actually-successful submit needs DATABASE_URL (createLead).

**Steps:**
1. Resize to 390x844, navigate to http://localhost:3000/en, scroll to the 'Contact Us' section (id='contact').
2. With all fields empty, tap the 'Send' button; assert a toast with text 'Enter phone number!' appears and the phone input gets aria-invalid.
3. Type a valid UZ number into the phone field (e.g. 90 123 45 67 so digits >= 9), leave name empty, tap 'Send'; assert the toast 'Enter your name!' and a role='alert' element (id='name-error') with text 'Enter your name!'.
4. Fill 'Your Name', leave message empty, tap 'Send'; assert the toast 'Enter message!'.
5. (Env-gated) Fill message and tap 'Send'; assert a loading toast 'Please wait...' appears; with DATABASE_URL configured the fields clear on success.

**Expected:** Validation is enforced in order phone -> name -> message: empty form -> 'Enter phone number!'; valid phone + empty name -> 'Enter your name!' (plus inline role='alert' id='name-error'); valid name + empty message -> 'Enter message!'. On a valid submit a 'Please wait...' loading toast shows; with a DB the inputs reset. The form and all controls fit 390px with no horizontal page scroll.

**Grounding (selectors/source):** Contact section id='contact' (Contact/index.tsx). Fields: phone PhoneInput (label 'Your Phone Number', input id='phone-input'), name (input id='name', label/placeholder 'Your Name'), message (textarea id='message', placeholder 'Enter your message here...'). Submit button text 'Send' (contact.btn). Validation toasts: 'Enter phone number!', 'Enter your name!', 'Enter message!' (toastMessage.*). Inline errors render <span role='alert' id='phone-error'|'name-error'>.

**Notes:** New case (gap #9 mobile contact). Validation is client-side (Contact/index.tsx:31-57) so the toast assertions need no secrets.

#### `mob-est-01` — Mobile viewport: estimator RESULT step layout (currency switcher in hero card, rail/preview hidden)  `P1`

**Preconditions:** 390x844 viewport.

**Steps:**
1. Resize to 390x844, navigate to http://localhost:3000/en/estimator.
2. Confirm the desktop step rail and the desktop live-estimate side panel are NOT present, and the fixed bottom bar showing a live range plus 'Next →' is visible.
3. Tap 'Next →' repeatedly through all steps, then tap 'See estimate →' on the final (Details) step to reach the result.
4. On the result: confirm the badge 'Your estimate is ready', heading "Here's your honest range.", and the 'Estimated budget' range card render, and that a CurrencySwitcher control now appears INSIDE the hero range card (the lg:hidden block).
5. Confirm the fixed bottom navigation bar is gone at the result step and the page has no horizontal scroll.

**Expected:** At 390px there is no desktop rail and no desktop LivePreview panel; navigation uses the bottom bar until the result. At the result the CurrencySwitcher is rendered within the hero range card (only mobile instance), the badge/heading/range are visible, and the sticky bottom bar disappears (because !isResultStep is false).

**Grounding (selectors/source):** Wizard.tsx — the step rail <aside> is 'hidden lg:flex' (line 230) and LivePreview <aside> is 'hidden lg:block' (LivePreview.tsx:34), so both are absent on mobile. Mobile navigates via the fixed bottom bar 'Next →' / '←' (aria-label 'Back'), which is rendered only when !isResultStep (Wizard.tsx:325). ResultPanel renders the CurrencySwitcher inside a 'lg:hidden' block within the hero range card (ResultPanel.tsx:61-63). Result headings: 'Your estimate is ready' (resultBadge), "Here's your honest range." (resultHeading), 'Estimated budget' (estimateRange).

**Notes:** New case (gap #9 mobile estimator result).

#### `redir-01` — Root and www redirects collapse to a single 308  `P1`

**Preconditions:** Dev server running. The www variant needs a spoofed Host header.

**Steps:**
1. Navigate the browser to http://localhost:3000/ and observe the final URL.
2. Call browser_network_requests and inspect the request for '/': confirm exactly ONE 308 response whose Location resolves to '/uz', not a chain of two redirects.
3. (Env-gated / manual) With a spoofed Host, run: curl -sI -H 'Host: www.softwhere.uz' https://<deployed-origin>/ and inspect the response.

**Expected:** Browsing to '/' produces a single 308 to '/uz' and the browser lands on /uz (Uzbek homepage). The network log shows one 308 for the root request (no double hop). For the www variant, Host 'www.softwhere.uz' at '/' returns a single 308 whose Location is the apex host at '/uz' (www-strip and root->/uz are combined in one response).

**Grounding (selectors/source):** src/proxy.ts:17-22 — when isWww || isRoot, returns a SINGLE NextResponse.redirect(newUrl, 308) that both strips 'www.' and rewrites '/' to '/uz'. matcher (proxy.ts:33) includes '/'.

**Notes:** New case (gap #10). The root '/'->/uz hop is testable locally in the browser; the www->apex hop requires a spoofed Host header the accessibility-tree browser cannot set over plain localhost — exercise via curl against a deployed origin or mark manual (see envNotes).

#### `api-auth-01` — Neon Auth catch-all: unauthenticated GET /api/auth/get-session  `P2`

**Preconditions:** Dev server running. Behavior branches on whether NEON_AUTH_* env is configured.

**Steps:**
1. Send GET http://localhost:3000/api/auth/get-session with NO Authorization header and NO session cookie.
2. Read the HTTP status and JSON/text body.
3. Repeat once with an obviously-invalid cookie to confirm it is still treated as unauthenticated.

**Expected:** If NEON_AUTH_* is configured: 200 with a JSON body representing an empty/null session (Better Auth get-session returns null session + null user when unauthenticated), NOT the admin app and NOT a 401 crash. If NEON_AUTH_* is MISSING: the wrapped handler returns HTTP 500 for the request (it 500s per-request instead of throwing at import, per route.ts:15-16 comment). Either way the endpoint never leaks an authenticated session to an anonymous caller.

**Grounding (selectors/source):** Route src/app/api/auth/[...path]/route.ts (export const dynamic='force-dynamic'; GET wraps getAuth().handler().GET). No auth cookie/header sent.

**Notes:** New case — surface previously had ZERO coverage (gap #1). The key assertion is the wrapper contract: missing env => 500 per request, not an import-time crash.

#### `est-rail-01` — Estimator rail buttons: match accessible names by substring/regex (leading step number or ✓)  `P2`

**Preconditions:** Desktop viewport so the left rail is visible.

**Steps:**
1. Navigate to http://localhost:3000/en/estimator (desktop).
2. Snapshot the left rail and read each button's accessible name.
3. When locating a rail step (in this and any other estimator case such as est-01/est-09), match by substring or regex (e.g. name contains 'Project' / matches /Scope$/), NOT by the exact string 'Project' or 'Scope'.

**Expected:** Rail buttons expose names like '1 Project', '2 Scope', '3 Features', '4 Integrations', '5 Technology', '6 Details', '7 Estimate' before completion, switching the leading '1'..'7' to '✓' for already-completed steps (e.g. '✓ Scope'). Substring/regex matching succeeds; an exact-equality match on 'Project'/'Scope' would fail.

**Grounding (selectors/source):** Wizard.tsx:216 builds rail labels from step.* keys: Project, Scope, Features, Integrations, Technology, Details, Estimate. Wizard.tsx:253 renders '{done?"✓":i+1}' in a span BEFORE the label, so each rail button's accessible name concatenates the badge and label — e.g. '1 Project', '2 Scope' before completion, and '✓ Scope' once that step is done.

**Notes:** New guidance case (gap #11). Corrects the assumption in draft est-01/est-09 that rail buttons are named exactly 'Project'/'Scope' — instruct the agent to match by substring/regex to tolerate the leading number or '✓'.

#### `hdr-kbd-01` — Header LanguageSwitcher and mobile burger keyboard behavior  `P2`

**Preconditions:** For the burger sub-steps, resize to a mobile width (e.g. 390x844) so the burger is visible.

**Steps:**
1. On http://localhost:3000/en at desktop width, Tab to (or click) the button named 'Language'; confirm aria-expanded becomes true and the En/Ru/Uz options appear.
2. Press Escape; confirm aria-expanded returns to false and the menu closes.
3. Open the Language menu again, then click somewhere outside it (page body); confirm it closes (aria-expanded false).
4. Resize to 390x844. Focus the burger button named 'Open menu' and press Enter; confirm its accessible name becomes 'Close menu', aria-expanded becomes true, and the mobile nav (#mobile-nav) is revealed (inert removed).
5. Press Space (or Enter) on the burger again; confirm it collapses back to 'Open menu' with aria-expanded false.

**Expected:** Language trigger toggles aria-expanded and menu visibility; Escape closes it; a click outside closes it. The burger toggles between accessible names 'Open menu'/'Close menu' with aria-expanded tracking, and Enter/Space both operate it. When closed, #mobile-nav is inert (not focusable); when open it is interactive.

**Grounding (selectors/source):** LanguageSwitcher trigger: <button aria-haspopup='true' aria-expanded={open} aria-controls='desktop-lang-menu' aria-label='Language'> (Header/index.tsx:63-71). Escape + click-outside close it (useEffect Header/index.tsx:34-48). Burger: <button aria-label={isOpen?'Close menu':'Open menu'} aria-expanded={isOpen} aria-controls='mobile-nav'> (Header/index.tsx:249-260).

**Notes:** New case (gap #8). Note the Escape/click-outside listeners are only attached while the menu is open (effect gated on `open`).

#### `mob-blog-01` — Mobile viewport: blog listing and post render correctly at 390px  `P2`

**Preconditions:** Seeded published posts in the target locale for the listing/post to be non-empty; otherwise assert the empty state.

**Steps:**
1. Resize to 390x844.
2. Navigate to http://localhost:3000/en/blog; confirm the page body does not scroll horizontally and the 'Blog' heading plus description render.
3. If posts exist, confirm cards stack in a single column and each exposes a 'Read More' link; tap the first card's title link.
4. On the post page, confirm the h1 title, the 'Back to Blog' link, and the breadcrumb are visible and the article content does not overflow horizontally.
5. If NO posts exist, instead assert the empty-state text 'No posts available at the moment.' is shown.

**Expected:** At 390px the listing and post pages are single-column, readable, and have no horizontal page scroll. With data: 'Read More' navigates to /en/blog/<slug>, which shows the post h1 + 'Back to Blog'. Without data: the listing shows exactly 'No posts available at the moment.'.

**Grounding (selectors/source):** Listing: BlogListClient.tsx — heading blog.title ('Blog'), 'Read More' links, empty state 'No posts available at the moment.'. Post page: [slug]/page.tsx — h1 with post title, 'Back to Blog' link, breadcrumb 'Home › Blog › <title>'.

**Notes:** New case (gap #9 mobile coverage for blog surfaces).

#### `scroll-01` — ScrollToTop button appears past 500px and returns to top  `P2`

**Preconditions:** A page tall enough to scroll (e.g. the homepage /en or a long blog post).

**Steps:**
1. Navigate to http://localhost:3000/en and confirm the ScrollToTop control is hidden while at the top (scrollY <= 500).
2. Scroll down past 500px; confirm the fixed bottom-right button becomes visible.
3. Activate the button (click it); confirm the page smooth-scrolls back to the top (scrollY returns to ~0).

**Expected:** The button is hidden at the top, appears after scrolling >500px, and clicking it scrolls the window back to the top. Because the button is icon-only (Image alt=''), it has no accessible name — locate it by its fixed bottom-right position / being the only nameless button, or via browser_evaluate, rather than by role+name.

**Grounding (selectors/source):** src/shared/components/ScrollToTop/index.tsx — a fixed bottom-right <button> containing an <Image alt=''> (icon-only, so NO accessible name); it gains the visible 'show' class only when window.scrollY > 500. Mounted globally in [locale]/layout.tsx:142.

**Notes:** New case (gap #12, ScrollToTop portion). The cross-locale banner/toggle keys (blog.availableIn/viewIn/showAllLocales/showCurrentLocale) are NOT rendered by any component (orphaned message keys) — no testable UI exists for them; see envNotes.

---

## Provenance

- Total cases: **92**
- Draft cases corrected in place after critic verification: `home-04`, `cf-14`, `est-08`, `cf-05`
- Coverage gaps the critic found (all addressed above): 13
- Every selector/copy string was quoted from source at generation time; if a case fails on a missing element, `grep src/messages/en.json` for the quoted copy first — the UI may have legitimately changed.
