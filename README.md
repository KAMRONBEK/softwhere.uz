# Softwhere.uz

[![Next.js](https://img.shields.io/badge/Next.js-14.1.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)

A modern, multilingual blog platform and portfolio website built with Next.js 14, featuring automated content generation, internationalization, and a comprehensive admin panel.

## 🌟 Features

### 🌍 **Multilingual Support**

- **3 Languages**: Uzbek (uz), Russian (ru), English (en)
- **Smart Language Switching**: Automatic detection and seamless switching between languages
- **Localized Content**: Full internationalization with `next-intl`

### 🤖 **AI-Powered Content Generation**

- **Automated Blog Posts**: Weekly automated blog post generation using Google Generative AI
- **GitHub Actions Integration**: Scheduled content creation every Monday at 9 AM UTC
- **Multi-language Generation**: Simultaneous post creation in all supported languages
- **Custom Topics**: Configurable topics and categories for generated content

### 📝 **Advanced Blog System**

- **Dynamic Routing**: SEO-friendly URLs with slug-based navigation
- **Rich Content**: Markdown support with syntax highlighting
- **Related Posts**: Smart content linking across languages
- **Categories & Tags**: Organized content structure
- **Reading Time**: Automatic reading time calculation

### 🎨 **Modern UI/UX**

- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Dark/Light Theme**: Theme switching with `next-themes`
- **Smooth Animations**: AOS (Animate On Scroll) integration
- **Interactive Components**: Modern sliders, type animations, and transitions
- **Professional Portfolio**: Showcase section for projects and skills

### 🔐 **Admin Panel**

- **Secret Access**: Hidden admin interface (5 clicks on top-left corner)
- **Content Management**: Full CRUD operations for blog posts
- **Publish/Unpublish**: Draft and published post management
- **Multi-language Editing**: Manage content across all languages

### 📊 **Performance & SEO**

- **Optimized Images**: Next.js Image optimization with Sharp
- **SEO Ready**: Meta tags, structured data, and sitemap generation
- **Fast Loading**: Optimized bundle size and lazy loading
- **Analytics Ready**: Built-in performance monitoring

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Yarn package manager
- MongoDB Atlas account
- Google AI API key (for content generation)

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

3. **Environment Setup**

   ```bash
   cp env.example .env.local
   ```

   Configure your environment variables:

   ```env
   MONGODB_URI=your_mongodb_connection_string
   DEEPSEEK_API_KEY=your_deepseek_api_key
   API_SECRET=your_api_secret_key
   UNSPLASH_ACCESS_KEY=your_unsplash_access_key (optional, for blog cover images)
   ```

4. **Run the development server**

   ```bash
   yarn dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🛠️ Available Scripts

| Script               | Description                     |
| -------------------- | ------------------------------- |
| `yarn dev`           | Start development server        |
| `yarn build`         | Build for production            |
| `yarn start`         | Start production server         |
| `yarn lint`          | Run ESLint                      |
| `yarn lint:fix`      | Fix ESLint errors               |
| `yarn format`        | Format code with Prettier       |
| `yarn type-check`    | Run TypeScript type checking    |
| `yarn generate-post` | Generate new blog post manually |

## 🏗️ Project Structure

```
softwhere.uz/
├── .github/workflows/     # GitHub Actions for automated posting
├── public/               # Static assets
├── scripts/              # Utility scripts
│   └── generate-blog-post.ts
├── src/
│   ├── app/             # Next.js 14 App Router
│   │   ├── [locale]/    # Internationalized routes
│   │   └── api/         # API routes
│   ├── components/      # Reusable UI components
│   ├── constants/       # Application constants
│   ├── data/           # Static data and content
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Database and external integrations
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── tailwind.config.ts   # Tailwind CSS configuration
└── next.config.mjs     # Next.js configuration
```

## 🔧 Tech Stack

### **Frontend**

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with React Icons
- **Animations**: AOS, React Type Animation
- **Internationalization**: next-intl

### **Backend**

- **Database**: MongoDB with Mongoose
- **API**: Next.js API Routes
- **Authentication**: Custom implementation
- **File Handling**: Sharp for image optimization

### **AI & Automation**

- **Content Generation**: Google Generative AI
- **Automation**: GitHub Actions
- **Scheduling**: Cron jobs for weekly posts

### **Development Tools**

- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier
- **Package Manager**: Yarn
- **Deployment**: Vercel

## 🌐 Deployment

### **Vercel (Recommended)**

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on every push to main branch

### **Manual Deployment**

```bash
yarn build
yarn start
```

## 🔐 Admin Access

The admin panel is accessible through a secret method:

1. Click the top-left corner of the website 5 times quickly (within 3 seconds)
2. An admin button will appear in the top-right corner for 10 seconds
3. Click the button to access the admin panel

## 🤖 Automated Content Generation

The platform automatically generates blog posts every Monday at 9 AM UTC using GitHub Actions. The system:

- Generates posts in all supported languages (uz, ru, en)
- Uses AI to create relevant tech content
- Automatically publishes to the blog
- Maintains consistent posting schedule

### Manual Generation

```bash
yarn generate-post
```

## 🌍 Internationalization

The platform supports three languages with automatic detection:

- **Uzbek (uz)** - Default language
- **Russian (ru)** - Secondary language
- **English (en)** - International language

Language switching preserves user context and provides seamless navigation between localized content.

## 📱 Responsive Design

- **Mobile First**: Optimized for mobile devices
- **Tablet Friendly**: Perfect tablet experience
- **Desktop Enhanced**: Rich desktop interface
- **Cross-browser**: Compatible with all modern browsers

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary. All rights reserved.

## 📞 Contact

- **Website**: [softwhere.uz](https://softwhere.uz)
- **GitHub**: [@KAMRONBEK](https://github.com/KAMRONBEK)

---

<div align="center">
  <strong>Built with ❤️ using Next.js and modern web technologies</strong>
</div>

## Development Setup

### Line Endings

This project uses LF line endings. To ensure consistent line endings across all environments:

1. Make sure your Git configuration is set correctly:
   ```bash
   git config --local core.autocrlf false
   ```

2. After cloning the repository, run:
   ```bash
   yarn normalize-line-endings
   ```

3. If you're using VS Code, the project settings will automatically use LF line endings.

4. If you encounter line ending issues, run:
   ```bash
   yarn format
   ```
