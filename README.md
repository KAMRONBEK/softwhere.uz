# Softwhere.uz

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Neon](https://img.shields.io/badge/Neon-Postgres-00E599?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)

A modern, multilingual blog platform and portfolio website built with Next.js 16, featuring AI-powered content generation (DeepSeek), internationalization, and project cost estimator.

---

## Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Available Scripts](#-available-scripts)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [API Routes](#-api-routes)
- [GitHub Actions](#-github-actions)
- [Deployment](#-deployment)
- [Development](#-development)
- [Contributing](#-contributing)

---

## 🌟 Features

### 🌍 Multilingual Support

- **3 Languages**: Uzbek (uz), Russian (ru), English (en)
- **Smart Language Switching**: Automatic detection and seamless switching via `next-intl`
- **Locale-aware Routes**: `/[locale]/blog`, `/[locale]/estimator`, etc.

### 🤖 AI-Powered Content Generation

- **DeepSeek AI**: Blog post generation via DeepSeek API
- **Multi-language Generation**: Simultaneous post creation in all supported languages
- **Service Pillars**: SEO topics organized by category (mobile-app, MVP, AI, web, telegram, CRM, etc.)
- **Source Material**: URL or raw text as input for AI generation
- **Cover Images**: Optional Unsplash integration for blog covers

### 📝 Blog System

- **Dynamic Routing**: SEO-friendly URLs with slug-based navigation
- **Rich Content**: Markdown with syntax highlighting (rehype-highlight, remark-gfm)
- **Related Posts**: Cross-language linking via `generationGroupId`
- **Categories & Tags**: Organized by service pillars
- **Reading Time**: Automatic calculation

### 💰 Project Cost Estimator

- **Multi-step Wizard**: Project type, tech stack, complexity, pages, features
- **AI-enhanced Estimates**: DeepSeek refines formula-based estimates
- **Project Types**: Mobile, web, telegram, desktop, other

### 🎨 Portfolio & UI

- **Responsive Design**: Mobile-first with Tailwind CSS
- **Dark/Light Theme**: `next-themes` integration
- **Animations**: AOS (Animate On Scroll), React Type Animation
- **Project Showcase**: Portfolio slider with App Store / Play Market links

### 📊 Performance & SEO

- **Optimized Images**: Next.js Image + Sharp
- **SEO Ready**: Meta tags, structured data, sitemap, robots.txt
- **Analytics**: Vercel Analytics & Speed Insights

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Yarn
- Neon (serverless Postgres) — free tier is fine
- DeepSeek API key (for blog generation)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/KAMRONBEK/softwhere.uz.git
   cd softwhere.uz
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Environment setup**

   ```bash
   cp env.example .env.local
   ```

   Edit `.env.local` with your values (see [Environment Variables](#-environment-variables)).

4. **Run development server**

   ```bash
   yarn dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000)

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon (serverless Postgres) connection string |
| `NEXT_PUBLIC_BASE_URL` | ✅ | Base URL for API calls (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_TG_BOT_TOKEN` | ✅* | Telegram bot for contact form notifications |
| `NEXT_PUBLIC_TG_CHAT_ID` | ✅* | Telegram chat for contact form notifications |
| `DEEPSEEK_API_KEY` | ❌ | DeepSeek AI for blog generation & estimator |
| `UNSPLASH_ACCESS_KEY` | ❌ | Cover images for AI-generated posts |

*Required for contact form

See `env.example` for setup. Never commit `.env.local` or real credentials.

---

## 🛠️ Available Scripts

| Script | Description |
|--------|--------------|
| `yarn dev` | Start development server (pulls env from Vercel) |
| `yarn build` | Build for production |
| `yarn start` | Start production server |
| `yarn lint` | Run ESLint |
| `yarn lint:fix` | Fix ESLint errors |
| `yarn format` | Format code with Prettier |
| `yarn format:check` | Check formatting |
| `yarn type-check` | TypeScript type checking |
| `yarn normalize-line-endings` | Normalize line endings (LF) |
| `yarn env:pull:development` | Pull Vercel env for development |
| `yarn env:pull:production` | Pull Vercel env for production |

### CLI Scripts (run with `npx tsx`)

| Command | Description |
|---------|-------------|
| `npx tsx scripts/generate-post.ts [options]` | Generate blog post(s) and save to Neon Postgres |
| `npx tsx scripts/regenerate-posts.ts [flags]` | Fix/heal blog posts (structure, dedup, images) |

**generate-post options:**

- `--category <id>` — Service pillar (e.g. `mobile-app-development`, `random`)
- `--customTopic <str>` — Custom topic (overrides category)
- `--sourceUrl <url>` — URL to fetch as source material
- `--sourceText <str>` — Raw text as source (max 5000 chars)
- `--locales <list>` — Comma-separated (default: `en,ru,uz`)

**regenerate-posts flags:**

- `--dry-run` — Report issues without writing
- `--analyze-only` — Only run analysis, print report
- `--force` — Process all groups (even healthy ones)

---

## 🏗️ Project Structure

```
softwhere.uz/
├── .github/workflows/
│   ├── generate-post.yml    # Weekly post generation (Mon 9 AM UTC)
│   └── fix-posts.yml        # Manual fix/heal workflow
├── public/                  # Static assets
├── scripts/
│   ├── generate-post.ts     # CLI blog post generator
│   ├── regenerate-posts.ts  # Fix & heal posts
│   └── lib/
│       ├── similarity.ts    # Duplicate detection
│       └── post-structure.ts
├── src/
│   ├── app/                 # Next.js routes (logic-thin); may import any layer
│   │   ├── [locale]/        # Internationalized routes
│   │   │   ├── page.tsx     # Home
│   │   │   ├── admin/       # Admin posts UI
│   │   │   ├── blog/        # Blog listing & posts
│   │   │   └── estimator/   # Cost estimator
│   │   ├── api/             # API route handlers
│   │   ├── sitemap.ts
│   │   └── robots.ts
│   ├── core/                # Framework/app-agnostic infra (imports: core only)
│   │   │                    #   env, logger, db, i18n, ai, http, auth, constants
│   ├── shared/              # Reusable non-domain code (imports: core, shared)
│   │   ├── components/      # Button, Header, Footer, sections/, …
│   │   ├── data/            # projects
│   │   ├── types/
│   │   └── utils/           # slug, analytics, send, security, rateLimit
│   ├── modules/             # Business capabilities (imports: core, shared, own module)
│   │   ├── blog/            # components, api (generator), model, data, context, utils
│   │   ├── estimator/       # components, data, utils, constants, types
│   │   └── admin/           # components, utils
│   ├── messages/            # next-intl locale bundles (en/ru/uz)
│   └── proxy.ts             # next-intl routing proxy (middleware)
├── eslint.config.mjs        # ESLint flat config + eslint-plugin-boundaries
├── tailwind.config.ts
└── next.config.mjs
```

> Layer import direction (`core → shared → modules → app`) is enforced by
> `eslint-plugin-boundaries`. See [`docs/architecture.md`](docs/architecture.md).

---

## 🔧 Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5.8 |
| **Styling** | Tailwind CSS |
| **Database** | Neon Postgres + Drizzle |
| **AI** | DeepSeek (OpenAI-compatible API) |
| **i18n** | next-intl |
| **Deployment** | Vercel |

---

## 📡 API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/blog/posts` | GET | List blog posts |
| `/api/blog/posts/[slug]` | GET | Single post by slug |
| `/api/blog/posts/related` | GET | Related posts by `generationGroupId` |
| `/api/blog/generate` | POST | Generate blog posts (AI) |
| `/api/contact` | POST | Contact form (Telegram) |
| `/api/estimate` | POST | Project cost estimate |
| `/api/health` | GET | Health check |
| `/api/health/db` | GET | Database health |

---

## 🤖 GitHub Actions

### Generate Weekly Blog Post

- **Schedule**: Every Monday 9:00 UTC
- **Manual**: `workflow_dispatch` with inputs (category, customTopic, sourceUrl, sourceText)
- **Secrets**: Configure required repository secrets in GitHub

### Fix Blog Posts

- **Trigger**: Manual only
- **Inputs**: `mode` (dry-run | analyze-only | fix), `force` (boolean)
- **Purpose**: Enforce structure, deduplicate, inject images

---

## 🌐 Deployment

### Vercel (Recommended)

1. Connect the GitHub repo to Vercel
2. Add environment variables in the Vercel dashboard
3. Deploy on push to main

### Manual

```bash
yarn build
yarn start
```

---

## 📱 Development

### Line Endings

The project uses LF. After cloning:

```bash
git config --local core.autocrlf false
yarn normalize-line-endings
```

### Vercel Env

For local development with production-like env:

```bash
yarn env:pull:development
yarn dev
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary. © 2026 All rights reserved.

## 📞 Contact

- **Website**: [softwhere.uz](https://softwhere.uz)
- **GitHub**: [@KAMRONBEK](https://github.com/KAMRONBEK)

---

<div align="center">
  <strong>Built with ❤️ using Next.js and modern web technologies</strong>
</div>
