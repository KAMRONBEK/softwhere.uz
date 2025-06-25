# 🧭 Feature Estimator Section – Master Plan

> **Purpose:** Provide visitors with an interactive wizard to estimate project deadlines, development cost, and support fees based on their requirements (mobile app, web app, Telegram bot, etc.).

---

## 1. User Journey ✅

1. **Landing** – User scrolls to / clicks **"Estimate My Project"** CTA.
2. **Step-by-step wizard** asks for:
   1. **Project type** (mobile app, web app, Telegram bot, others). ✅
   2. **Platforms** (iOS, Android, both – visible for mobile app). ✅
   3. **Complexity / Difficulty** (MVP, Standard, Enterprise). ✅
   4. **Core functionality** – checklist (Camera, GPS/Location, Notifications, Payments, Chat, Offline mode, etc.). ✅
   5. **Screens / Pages count** – numeric slider (1 – 100). ✅
   6. **Advanced options** (preferred tech stack, 3rd-party integrations, CI/CD, automated tests). ✅
3. **Results page / sidebar** instantly updates with: ✅
   - **Approximate deadline** (in weeks). ✅
   - **Development cost** (USD & UZS). ✅
   - **1st-year support & maintenance cost** (percentage-based). ✅
   - **Feature-by-feature breakdown** (optional accordion). ✅
4. **Call-to-action**: "_"Send my estimate"_ → opens contact modal / navigates to contact section pre-filled with estimate ID.

---

## 2. UI / UX Notes

| Step | Component | Notes |
|------|-----------|-------|
| 1 | Card selector | Icons for each project type; highlight on hover. |
| 2 | Checkbox group | Disable if not Mobile App. |
| 3 | Difficulty slider (3 stops) | Tooltips explaining scope. |
| 4 | Multi-select feature chips | Category tabs (Core, Media, Communication). |
| 5 | Range slider + input | Show screen/page guidelines. |
| 6 | Accordion with advanced fields | Collapsed by default. |
| Results | Sticky sidebar / bottom sheet on mobile | Smooth animation when values change. |

Accessibility: all controls keyboard-navigable, ARIA labels, high-contrast compatible.

---

## 3. Data Model & Formulae ✅

```ts
interface EstimatorInput {
  projectType: 'mobile' | 'web' | 'telegram' | 'desktop' | 'other';
  platforms?: ('ios' | 'android')[]; // mobile only
  complexity: 'mvp' | 'standard' | 'enterprise';
  features: FeatureKey[];
  pages: number;
  techStack?: TechnologyKey[];
}
```

| Variable | Source | Example |
|----------|--------|---------|
| **BaseCost** | projectType | mobile = $8 000, web = $5 000, telegram = $3 000 |
| **ComplexityMultiplier** | complexity | mvp ×1, standard ×1.5, enterprise ×2 |
| **FeatureCost** | per-feature table | Camera $1 200, GPS $800, Chat $1 000… |
| **PageCost** | pages × $120 | |
| **TechStackAdj.** | advanced options | Native iOS +15 %, Flutter –5 % … |

```text
DevCost   = (BaseCost × ComplexityMultiplier)
          + Σ FeatureCost
          + PageCost
          × TechStackAdjustment
Deadline  = ceil( DevCost / 1400 )  // ≈ 1 dev week per $1.4k
Support   = DevCost × 0.15          // first-year 15 %
```

All constants live in **`src/constants/estimator.ts`** for easy tuning. ✅

---

## 4. Tech Stack & Architecture ✅

- **Frontend**: React (Next.js app directory), TypeScript, Tailwind CSS. ✅
- **State**: React Context + useReducer (light) _or_ Zustand. ✅
- **Forms**: `react-hook-form` + `zod` for validation. ✅
- **Calculations**: Pure functions in `src/utils/estimator.ts` (unit-tested). ✅
- **API** *(optional)*: `/api/estimate` to perform calc server-side & store quote in DB. ✅
- **Persistence**: MongoDB collection `estimates` (reuse existing `lib/db.ts`). ✅
- **Analytics**: log selections via `logger` util. ✅

---

## 5. Implementation Phases (Continuous Integration) ✅

_All work is committed **directly inside this repository** (branch `feature/estimator-section`). Integration with the existing codebase happens **from day 1**, not as a post-development step._

| Phase | Key Deliverables | Owner | Est. Time |
|-------|------------------|-------|----------|
| 1 | Baseline constants (`constants/estimator.ts`), initial types & utils scaffold (`types/estimator.ts`, `utils/estimator.ts`) | FE Dev | 0.5 d ✅ |
| 2 | UI wireframes (Figma) & skeleton React components committed under `components/Estimator/*` | FE Dev | 3 d ✅ |
| 3 | Step wizard logic, state management, live calculation hooking utils – committed to `app/[locale]/estimator` | FE Dev | 3 d ✅ |
| 4 | API route `/api/estimate` + `api.estimator` client methods, Mongo model `Estimate` | BE Dev | 1 d ✅ |
| 5 | Unit / component tests, i18n strings, accessibility polish | QA + FE Dev | 1 d |
| 6 | End-to-end Playwright script, sitemap & robots update, performance tweaks | QA | 1 d |
| 7 | Review, merge to `dev`, deploy preview to Vercel (automatic) | DevOps | 0.5 d |

_Total calendar time remains ≈ 8 working days._

---

## 6. Future Enhancements

- **User accounts** to save multiple estimates.
- **PDF export** of estimate.
- **Admin dashboard** to adjust pricing without redeploy.
- **Currency switcher** based on locale.
- **AI upsell suggestions** ("Add push notifications for +$500, +1 week").

---

## 7. Acceptance Criteria

- 🎯 Estimates vary logically when toggling options. ✅
- 🖥️ Works across viewport sizes (≥ 360 px).
- 🌐 Localised strings via `next-intl` (uz, ru, en).
- 🗜️ Scores ≥ 90 in Lighthouse performance & accessibility.
- 🔒 No sensitive formulas exposed in client bundle (if server calc chosen). ✅
- 🧪 90 % test coverage for calculation utils.

---

### Contact

Feel free to ping **@SoftWhere.uz Team** for clarifications.

---

## 8. Integration with Existing Codebase ✅

> The estimation feature must adhere to the **Development Guidelines** and reuse the current architecture wherever possible.

### 8.1 Directory & File Layout ✅

```
src/
│
├─ app/
│   └─ [locale]/
│       └─ estimator/
│           ├─ page.tsx           # Entry point (SSR friendly) ✅
│           └─ layout.tsx         # Wrapper to isolate estimator styles
│
├─ components/
│   └─ Estimator/
│       ├─ Wizard.tsx            # Main wizard controller ✅
│       ├─ Steps/
│       │   ├─ ProjectTypeStep.tsx ✅
│       │   ├─ PlatformsStep.tsx ✅
│       │   ├─ ComplexityStep.tsx ✅
│       │   ├─ FeaturesStep.tsx ✅
│       │   ├─ PagesStep.tsx ✅
│       │   └─ AdvancedStep.tsx
│       ├─ ResultSidebar.tsx     # Sticky results block ✅
│       └─ index.tsx             # Barrel export ✅
│
├─ constants/
│   └─ estimator.ts              # Pricing constants & multipliers ✅
│
├─ utils/
│   └─ estimator.ts              # Pure calculation helpers ✅
│
├─ types/
│   └─ estimator.ts              # EstimatorInput & related types ✅
│
└─ app/api/
    └─ estimate/
        └─ route.ts              # (optional) server-side estimation & save ✅
```

### 8.2 Reusing Helpers & Conventions ✅

1. **Logging** – import `logger` from `src/utils/logger.ts` for request logs. ✅
2. **API client** – expose `api.estimator.getQuote(input)` and `api.estimator.saveQuote(input)` in `src/utils/api.ts` to wrap fetch. ✅
3. **Constants** – follow pattern used in `constants/index.ts`. Example: ✅
   ```ts
   // src/constants/estimator.ts
   export const ESTIMATOR = {
     BASE_COST: {
       mobile: 8000,
       web: 5000,
       telegram: 3000,
       desktop: 6000,
       other: 4000,
     },
     FEATURE_PRICES: {
       camera: 1200,
       gps: 800,
       notifications: 600,
       payments: 900,
       chat: 1000,
       offline: 700,
     },
     PAGE_PRICE: 120,
     SUPPORT_RATE: 0.15,
   } as const;
   ```
4. **Internationalisation** – add strings to `src/messages/*.json` under `estimator` namespace.
5. **Design tokens** – use existing Tailwind config & CSS modules approach. ✅
6. **State storage** – persist wizard state in URL query (`?step=3&pages=12`) for shareability. ✅

### 8.3 Navigation & Discoverability

- Add a CTA button in **Header** and **Hero** sections which navigates to `/${locale}/estimator`.
- Update sitemap generator (`src/app/sitemap.ts`) to include the estimator page per locale.

### 8.4 Testing Strategy

1. **Unit tests** for `utils/estimator.ts` – jest + ts-jest.
2. **Component tests** – React Testing Library for wizard steps.
3. **E2E smoke** – Playwright scenario: complete wizard → verify results.

### 8.5 Deployment Checklist

- Verify new routes are covered by [`robots.ts`](mdc:src/app/robots.ts) – estimator should be **allowed** for SEO.
- Run `yarn lint`, `yarn type-check`, and `yarn format:check`.
- Add `.env` variable `ESTIMATOR_EMAIL_RECEIVER` if quote emailing is required.

---

## 9. Migration & Roll-Out Plan

1. **Branch**: `feature/estimator-section`.
2. **Phase merges** after each milestone (UI skeleton, calculations, API, i18n).
3. **UAT** with sample scenarios in staging.
4. **Soft launch** behind `/estimator?beta=true` flag for 1 week.
5. **Full launch** – remove flag, announce in blog & socials.
