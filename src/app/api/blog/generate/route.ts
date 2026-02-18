import dbConnect from '@/lib/db';
import BlogPost from '@/models/BlogPost';
import { verifyApiSecret } from '@/utils/auth';
import { getCoverImageForTopic } from '@/utils/unsplash';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Ensure API keys and URI are set
if (!process.env.GOOGLE_API_KEY) {
  console.error('FATAL ERROR: GOOGLE_API_KEY environment variable not set.');
  // Optionally throw an error during build/startup if critical
  // throw new Error("GOOGLE_API_KEY environment variable not set.");
}
if (!process.env.MONGODB_URI) {
  console.error('FATAL ERROR: MONGODB_URI environment variable not set.');
  // throw new Error("MONGODB_URI environment variable not set.");
}
if (!process.env.API_SECRET) {
  console.warn('API_SECRET environment variable not set. Blog generation endpoint is insecure.');
}

// Initialize the Google Generative AI client (only if API key exists)
const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
// Pass model name in an object
const model = genAI?.getGenerativeModel({ model: 'gemini-2.0-flash' });

const _TARGET_LOCALES: Array<'en' | 'ru' | 'uz'> = ['en', 'ru', 'uz'];

// Get current year for dynamic topics
const getCurrentYear = () => new Date().getFullYear();

// Blog topics specifically for mobile app and web development agencies
const BLOG_TOPICS = {
  'mobile-app-development': [
    `Complete Guide to Mobile App Development in ${getCurrentYear()}`,
    'Native vs Hybrid vs Cross-Platform: Which is Right for Your Business?',
    'iOS vs Android Development: Cost, Timeline, and Market Considerations',
    `Mobile App UI/UX Design Trends That Drive User Engagement in ${getCurrentYear()}`,
    'How to Choose the Right Mobile App Development Framework',
    'Mobile App Security: Best Practices for Protecting User Data',
    'App Store Optimization: Getting Your App Discovered',
    'The Complete Mobile App Development Process: From Idea to Launch',
    'Mobile App Monetization Strategies That Actually Work',
    'Cross-Platform Development with React Native vs Flutter',
  ],
  'telegram-development': [
    'Complete Guide to Telegram Bot Development for Businesses',
    'Telegram Mini Apps vs Traditional Mobile Apps: Which Should You Choose?',
    'How to Build a Telegram Bot That Drives Customer Engagement',
    `Monetizing Telegram Bots: Revenue Strategies for ${getCurrentYear()}`,
    'Telegram Mini Apps: The Future of In-App Experiences',
    'Building E-commerce Solutions with Telegram Bots',
    'Telegram Bot Security: Protecting Your Business and Users',
    'Advanced Telegram Bot Features: Payments, Webhooks, and More',
    'Telegram Bot vs WhatsApp Business: Which is Better for Your Business?',
    'Creating Interactive Telegram Mini Apps with Web Technologies',
  ],
  'web-development': [
    `Modern Web Development: Frameworks and Technologies in ${getCurrentYear()}`,
    'Progressive Web Apps (PWA): The Future of Web Development',
    'Website Performance Optimization: Speed Up Your Site',
    'Responsive Web Design: Best Practices for All Devices',
    'Next.js vs React: Choosing the Right Framework for Your Project',
    'Web Development Cost Breakdown: What You Need to Budget',
    'SEO-Friendly Web Development: Technical Best Practices',
    'Web Accessibility: Building Inclusive Digital Experiences',
    'E-commerce Website Development: Features That Drive Sales',
    `Web Development Trends That Will Shape ${getCurrentYear()}`,
  ],
  'business-strategy': [
    'How to Choose a Mobile App Development Company: Complete Guide',
    'Digital Transformation: Why Your Business Needs a Mobile App',
    'ROI of Mobile Apps: Measuring Success for Your Business',
    'Startup App Development: From MVP to Market Success',
    'Enterprise Mobile App Development: Challenges and Solutions',
    'Mobile App Development Timeline: What to Expect',
    'Outsourcing vs In-House Development: Making the Right Choice',
    'Mobile App Maintenance: Keeping Your App Competitive',
    'User Acquisition Strategies for Mobile Apps',
    'Building a Successful Tech Startup in Uzbekistan',
  ],
};

const CONTENT_TEMPLATES = {
  'ultimate-guide': {
    structure: [
      'Hook with surprising statistic or question',
      'Problem identification and market context',
      'Comprehensive solution breakdown (5-7 sections)',
      'Real-world case studies and examples',
      'Step-by-step implementation guide',
      'Advanced tips and expert insights',
      'Common pitfalls and how to avoid them',
      'Tools, resources, and recommendations',
      'Future trends and predictions',
      'Strong call-to-action with value proposition',
    ],
    tone: 'authoritative and comprehensive',
    targetLength: '3000-4000 words',
    seoFocus: 'long-tail keywords, comprehensive coverage',
  },
  'comparison-analysis': {
    structure: [
      'Market overview and why comparison matters',
      'Detailed analysis methodology',
      'Option 1: Deep dive with pros/cons/use cases',
      'Option 2: Deep dive with pros/cons/use cases',
      'Option 3: Additional alternative (if applicable)',
      'Side-by-side feature comparison table',
      'Cost analysis and ROI considerations',
      'Industry-specific recommendations',
      'Decision framework and checklist',
      'Expert recommendation with reasoning',
    ],
    tone: 'analytical and unbiased',
    targetLength: '2500-3500 words',
    seoFocus: 'comparison keywords, decision-making terms',
  },
  'case-study': {
    structure: [
      'Client challenge and background',
      'Initial situation and pain points',
      'Our approach and methodology',
      'Implementation process and timeline',
      'Technical solutions and innovations',
      'Results and measurable outcomes',
      'Lessons learned and insights',
      'Client testimonial and feedback',
      'How this applies to other businesses',
      'Next steps for similar projects',
    ],
    tone: 'storytelling and results-focused',
    targetLength: '2000-3000 words',
    seoFocus: 'industry-specific terms, success stories',
  },
  'trend-analysis': {
    structure: [
      'Current market landscape overview',
      'Emerging trends identification',
      'Data and statistics supporting trends',
      'Impact on businesses and industries',
      'Technology adoption patterns',
      'Predictions for next 2-3 years',
      'How to prepare and adapt',
      'Investment and strategy recommendations',
      'Regional market considerations (Uzbekistan/Central Asia)',
      'Action plan for businesses',
    ],
    tone: 'forward-thinking and analytical',
    targetLength: '2500-3500 words',
    seoFocus: 'trend keywords, future-focused terms',
  },
  'problem-solution': {
    structure: [
      'Industry problem identification',
      'Why traditional solutions fail',
      'Market research and pain point analysis',
      'Our innovative solution approach',
      'Technical implementation details',
      'Benefits and competitive advantages',
      'Implementation roadmap',
      'Success metrics and KPIs',
      'Scaling and optimization strategies',
      'Getting started guide',
    ],
    tone: 'solution-oriented and practical',
    targetLength: '2200-3200 words',
    seoFocus: 'problem-solving keywords, solution terms',
  },
  'how-to-guide': {
    structure: [
      'Why this matters for your business',
      'Prerequisites and preparation',
      'Step 1: Planning and strategy',
      'Step 2: Design and architecture',
      'Step 3: Development and implementation',
      'Step 4: Testing and quality assurance',
      'Step 5: Launch and deployment',
      'Step 6: Monitoring and optimization',
      'Troubleshooting common issues',
      'Advanced techniques and best practices',
      'Maintenance and long-term success',
    ],
    tone: 'instructional and practical',
    targetLength: '2800-3800 words',
    seoFocus: 'how-to keywords, tutorial terms',
  },
  'industry-insights': {
    structure: [
      'Industry state and current challenges',
      'Market size and growth projections',
      'Key players and competitive landscape',
      'Technology disruptions and innovations',
      'Regulatory and compliance considerations',
      'Regional market dynamics (Central Asia focus)',
      'Opportunities for businesses',
      'Investment and partnership strategies',
      'Risk assessment and mitigation',
      'Strategic recommendations',
    ],
    tone: 'expert analysis and strategic',
    targetLength: '2600-3600 words',
    seoFocus: 'industry keywords, market analysis terms',
  },
};

// Helper function to generate content for a specific locale
async function _generateLocalizedContent(
  baseTitle: string,
  baseContent: string,
  targetLocale: 'en' | 'ru' | 'uz'
): Promise<{ title: string; content: string }> {
  if (!model) throw new Error('AI Model not initialized');

  console.log(`Generating content for locale: ${targetLocale}...`);

  if (targetLocale === 'en') {
    // No translation needed for English
    return { title: baseTitle, content: baseContent };
  }

  // Generate Title Translation
  const titlePrompt = `Translate the following blog post title into ${targetLocale === 'ru' ? 'Russian' : 'Uzbek'}: "${baseTitle}". Only return the translated title.`;
  const titleResult = await model.generateContent(titlePrompt);
  const translatedTitle = (await titleResult.response).text().trim().replace(/^"|"$/g, '');

  if (!translatedTitle) throw new Error(`Failed to translate title to ${targetLocale}`);
  console.log(`   Translated Title (${targetLocale}): ${translatedTitle}`);

  // Generate Content Translation
  const contentPrompt = `Translate the following blog post content (which is in Markdown format) into ${targetLocale === 'ru' ? 'Russian' : 'Uzbek'}. Preserve the Markdown formatting (headings, lists, code blocks etc.). Only return the translated Markdown content.\n\nOriginal Content:\n${baseContent}`;
  const contentResult = await model.generateContent(contentPrompt);
  const translatedContent = (await contentResult.response).text().trim();

  if (!translatedContent) throw new Error(`Failed to translate content to ${targetLocale}`);
  console.log(`   Translated Content Snippet (${targetLocale}): ${translatedContent.substring(0, 100)}...`);

  return { title: translatedTitle, content: translatedContent };
}

// Function to select dynamic content template based on topic
function selectContentTemplate(topic: string): {
  templateKey: string;
  template: any;
} {
  const templates = Object.keys(CONTENT_TEMPLATES);

  // Smart template selection based on topic keywords
  if (topic.toLowerCase().includes('vs') || topic.toLowerCase().includes('comparison')) {
    return {
      templateKey: 'comparison-analysis',
      template: CONTENT_TEMPLATES['comparison-analysis'],
    };
  } else if (topic.toLowerCase().includes('guide') || topic.toLowerCase().includes('complete')) {
    return {
      templateKey: 'ultimate-guide',
      template: CONTENT_TEMPLATES['ultimate-guide'],
    };
  } else if (topic.toLowerCase().includes('how to') || topic.toLowerCase().includes('step')) {
    return {
      templateKey: 'how-to-guide',
      template: CONTENT_TEMPLATES['how-to-guide'],
    };
  } else if (topic.toLowerCase().includes('trend') || topic.toLowerCase().includes('future')) {
    return {
      templateKey: 'trend-analysis',
      template: CONTENT_TEMPLATES['trend-analysis'],
    };
  } else if (topic.toLowerCase().includes('case study') || topic.toLowerCase().includes('success')) {
    return {
      templateKey: 'case-study',
      template: CONTENT_TEMPLATES['case-study'],
    };
  } else if (topic.toLowerCase().includes('problem') || topic.toLowerCase().includes('solution')) {
    return {
      templateKey: 'problem-solution',
      template: CONTENT_TEMPLATES['problem-solution'],
    };
  } else if (topic.toLowerCase().includes('industry') || topic.toLowerCase().includes('market')) {
    return {
      templateKey: 'industry-insights',
      template: CONTENT_TEMPLATES['industry-insights'],
    };
  }

  // Random selection for variety if no specific match
  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

  return {
    templateKey: randomTemplate,
    template: CONTENT_TEMPLATES[randomTemplate as keyof typeof CONTENT_TEMPLATES],
  };
}

// Enhanced content generation with dynamic templates
async function generateBlogContent(topic: string, locale: string): Promise<string> {
  const currentYear = getCurrentYear();
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Select dynamic template
  const { templateKey, template } = selectContentTemplate(topic);

  // Generate content variations
  const contentVariations = [
    'data-driven with statistics and research',
    'story-driven with real examples and anecdotes',
    'technical deep-dive with code examples and implementations',
    'business-focused with ROI and strategic insights',
    'user-experience centered with practical tips',
    'industry-specific with regional market insights',
  ];

  const selectedVariation = contentVariations[Math.floor(Math.random() * contentVariations.length)];

  const languageInstruction =
    locale === 'en'
      ? 'Write in English'
      : locale === 'ru'
        ? 'ВАЖНО: Пишите ПОЛНОСТЬЮ на русском языке. Весь контент должен быть на русском языке. Не используйте английский язык.'
        : "MUHIM: BUTUNLAY o'zbek tilida yozing. Barcha kontent o'zbek tilida bo'lishi kerak. Ingliz tilini ishlatmang.";

  const prompt = `${languageInstruction}

Write a comprehensive, SEO-optimized blog post about "${topic}" for a mobile app and web development agency based in Uzbekistan.

CRITICAL LANGUAGE REQUIREMENT:
- The ENTIRE blog post must be written in ${locale === 'en' ? 'English' : locale === 'ru' ? 'Russian (русский язык)' : "Uzbek (o'zbek tili)"}
- Do not mix languages - use only ${locale === 'en' ? 'English' : locale === 'ru' ? 'Russian' : 'Uzbek'} throughout
- All headings, content, examples, and call-to-actions must be in ${locale === 'en' ? 'English' : locale === 'ru' ? 'Russian' : 'Uzbek'}
- Write the SAME comprehensive content as you would in English, just translated
- Do NOT write a shorter version - make it equally detailed and comprehensive

CONTENT STRATEGY:
- Template Type: ${templateKey}
- Content Approach: ${selectedVariation}
- Target Length: ${template.targetLength} (minimum 3000 words)
- SEO Focus: ${template.seoFocus}
- Tone: ${template.tone}

STRUCTURE TO FOLLOW:
${template.structure.map((section: string, index: number) => `${index + 1}. ${section}`).join('\n')}

IMPORTANT REQUIREMENTS:
- Current date context: Today is ${currentDate}, we are in ${currentYear}
- All references to years, trends, and "current" information must reflect ${currentYear}
- Target audience: Business owners and decision-makers in Uzbekistan and Central Asia
- Include region-specific insights and market conditions for Central Asia
- Add practical, actionable advice that readers can implement
- Include relevant statistics, data points, and industry insights
- Write comprehensive sections with detailed explanations
- Each section should be substantial with multiple paragraphs

SEO OPTIMIZATION:
- Use long-tail keywords naturally throughout the content
- Include semantic keywords related to the main topic
- Create compelling subheadings that answer user questions
- Add internal linking opportunities (mention related services)
- Include FAQ-style sections where appropriate
- Use schema-friendly formatting

CONTENT FORMATTING (Markdown):
- H1 for main title (engaging and keyword-rich)
- H2 for major sections (question-based when possible)
- H3 for subsections
- Bullet points and numbered lists for readability
- Bold text for key concepts and important points
- Blockquotes for expert insights or important statistics
- Code blocks for technical examples (if relevant)
- Tables for comparisons or data presentation

ENGAGEMENT ELEMENTS:
- Start with a compelling hook (statistic, question, or bold statement)
- Include real-world examples and case studies
- Add actionable tips and best practices
- Use conversational tone while maintaining professionalism
- End with strong call-to-action highlighting our services

SOURCES AND CREDIBILITY:
- When mentioning statistics, market data, or research findings, include credible sources with URLs
- Use reputable sources like: Statista, McKinsey, Gartner, IDC, Forrester, industry reports
- Format sources as: ${
    locale === 'en'
      ? '"According to [Source Name](URL), [statistic/fact]"'
      : locale === 'ru'
        ? '"Согласно [Название источника](URL), [статистика/факт]"'
        : '"[Manba nomi](URL) ma\'lumotlariga ko\'ra, [statistika/fakt]"'
  }
- Include at least 3-5 credible sources throughout the article
- Prefer recent data (2023-2025) when available
- For technical facts, reference official documentation or authoritative tech sources
- Examples of good sources: Statista.com, McKinsey.com, Gartner.com, World Bank, GSMA, eMarketer

CONTENT LENGTH REQUIREMENT:
- Write a comprehensive article of at least 3000 words
- Each major section should be detailed and informative
- Include multiple subsections under each main heading
- Provide in-depth analysis and practical insights

Make this content unique, valuable, and comprehensive. Avoid generic advice and focus on specific, actionable insights that demonstrate expertise.`;

  try {
    console.log(`Generating content for topic: "${topic}" in locale: ${locale}`);

    if (!model) {
      console.warn('Gemini model not initialized (GOOGLE_API_KEY missing), using fallback content');
      return generateFallbackContent(topic, locale);
    }

    const systemPrompt = `You are an expert content writer and SEO specialist with deep knowledge of technology, software development, and digital marketing. You create comprehensive, engaging blog posts that rank well in search engines and provide exceptional value to readers. You understand the Uzbekistan and Central Asian market dynamics and can create region-specific content that resonates with local businesses while maintaining global best practices.

${locale === 'ru' ? 'Вы пишете на русском языке для русскоязычной аудитории.' : locale === 'uz' ? "Siz o'zbek tilida o'zbek tilida so'zlashuvchi auditoriya uchun yozasiz." : ''}`;

    const fullPrompt = `${systemPrompt}\n\n---\n\n${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const generatedContent = (await result.response).text();

    const wordCount = generatedContent.split(/\s+/).length;
    console.log(`Generated content for ${locale}: ${wordCount} words`);

    if (wordCount < 500) {
      console.warn(`Generated content for ${locale} is too short (${wordCount} words), using fallback`);
      return generateFallbackContent(topic, locale);
    }

    return generatedContent;
  } catch (error) {
    console.error(`Error generating content for ${locale}:`, error);
    return generateFallbackContent(topic, locale);
  }
}

function generateFallbackContent(topic: string, locale: string): string {
  const currentYear = getCurrentYear();
  const { templateKey: _templateKey, template: _template } = selectContentTemplate(topic);

  const fallbackContent = {
    en: `# ${topic}: Complete Guide for ${currentYear}

## Why ${topic} Matters in ${currentYear}

The digital landscape in ${currentYear} has transformed how businesses operate, especially in emerging markets like Uzbekistan and Central Asia. ${topic} has become crucial for companies looking to stay competitive and reach their target audiences effectively.

## Current Market Landscape

In ${currentYear}, we're seeing unprecedented growth in digital adoption across Central Asia. According to [Statista](https://www.statista.com/outlook/dmo/digital-media/central-asia), the digital market in Central Asia is expected to grow by 15.2% annually. Businesses that invest in ${topic.toLowerCase()} are experiencing:

- **40% higher customer engagement** compared to traditional approaches ([McKinsey Digital](https://www.mckinsey.com/capabilities/mckinsey-digital))
- **Increased market reach** beyond geographical boundaries
- **Improved operational efficiency** through digital transformation
- **Better ROI** on marketing and development investments

## Comprehensive Analysis of ${topic}

### Understanding the Fundamentals

${topic} encompasses several key components that work together to create successful digital solutions. Our experience working with over 100+ clients in the region has shown that success depends on:

1. **Strategic Planning** - Aligning technology with business objectives
2. **User-Centric Design** - Creating experiences that resonate with local users
3. **Technical Excellence** - Implementing robust, scalable solutions
4. **Market Adaptation** - Understanding regional preferences and behaviors

### Implementation Strategies

Based on our extensive experience in the Uzbekistan market, here are proven strategies for ${topic.toLowerCase()}:

#### Phase 1: Research and Planning
- Market analysis and competitor research
- User persona development for Central Asian markets
- Technical requirements assessment
- Budget and timeline planning

#### Phase 2: Design and Development
- User experience design with cultural considerations
- Technical architecture planning
- Agile development methodology
- Quality assurance and testing

#### Phase 3: Launch and Optimization
- Soft launch with select user groups
- Performance monitoring and analytics
- User feedback collection and analysis
- Continuous improvement and optimization

## Regional Market Insights

The Central Asian market, particularly Uzbekistan, presents unique opportunities and challenges:

### Opportunities
- **Growing digital literacy** among younger demographics
- **Government support** for digital transformation initiatives ([World Bank Digital Development](https://www.worldbank.org/en/topic/digitaldevelopment))
- **Increasing smartphone penetration** (85%+ in urban areas) ([GSMA Mobile Economy](https://www.gsma.com/mobileeconomy/))
- **Rising e-commerce adoption** post-pandemic ([eMarketer](https://www.emarketer.com/))

### Challenges
- **Language localization** requirements (Uzbek, Russian, English)
- **Payment system integration** with local banks
- **Cultural sensitivity** in design and messaging
- **Infrastructure considerations** for rural areas

## Best Practices for ${currentYear}

### Technical Considerations
- **Mobile-first approach** - 70% of users access digital services via mobile ([Statista Mobile Usage](https://www.statista.com/statistics/277125/share-of-website-traffic-coming-from-mobile-devices/))
- **Progressive Web Apps** - Combining web and mobile app benefits ([Google Web.dev](https://web.dev/progressive-web-apps/))
- **API-first architecture** - Enabling future integrations and scalability
- **Cloud infrastructure** - Ensuring reliability and performance

### User Experience Principles
- **Localization beyond translation** - Cultural adaptation of interfaces
- **Accessibility compliance** - Ensuring inclusive design
- **Performance optimization** - Fast loading times for varying internet speeds
- **Offline functionality** - Supporting users with limited connectivity

## Common Pitfalls and How to Avoid Them

### Technical Pitfalls
1. **Over-engineering solutions** - Keep it simple and scalable
2. **Ignoring mobile users** - Mobile-first is essential
3. **Poor performance optimization** - Speed affects user retention
4. **Inadequate security measures** - Protect user data and privacy

### Business Pitfalls
1. **Skipping market research** - Understand your local audience
2. **Underestimating localization** - Language and culture matter
3. **Insufficient testing** - Test with real users in real conditions
4. **Neglecting post-launch support** - Maintenance is crucial

## Tools and Technologies for ${currentYear}

### Development Frameworks
- **React Native / Flutter** - Cross-platform mobile development
- **Next.js / Nuxt.js** - Modern web application frameworks
- **Node.js / Python** - Backend development
- **PostgreSQL / MongoDB** - Database solutions

### Design and Analytics Tools
- **Figma / Adobe XD** - UI/UX design
- **Google Analytics 4** - Advanced analytics
- **Hotjar / Mixpanel** - User behavior analysis
- **A/B testing platforms** - Optimization tools

## ROI and Success Metrics

Measuring success in ${topic.toLowerCase()} requires tracking the right metrics:

### Key Performance Indicators
- **User acquisition cost** (target: <$10 for mobile apps)
- **User retention rates** (aim for 30%+ after 30 days)
- **Conversion rates** (industry average: 2-5%)
- **Customer lifetime value** (should exceed acquisition cost by 3x)

### Business Impact Metrics
- **Revenue growth** from digital channels
- **Operational efficiency** improvements
- **Customer satisfaction** scores
- **Market share** expansion

## Future Trends and Predictions

Looking ahead in ${currentYear} and beyond:

### Emerging Technologies
- **AI and Machine Learning** integration
- **Voice interfaces** and conversational UI
- **Augmented Reality** experiences
- **Blockchain** for security and transparency

### Market Evolution
- **Super app ecosystems** gaining popularity
- **Social commerce** integration
- **Sustainability focus** in digital solutions
- **Privacy-first** design approaches

## Getting Started: Action Plan

### Immediate Steps (Week 1-2)
1. **Define clear objectives** and success metrics
2. **Conduct market research** specific to your industry
3. **Analyze competitors** and identify opportunities
4. **Set realistic budget** and timeline expectations

### Short-term Goals (Month 1-3)
1. **Develop detailed project plan** with milestones
2. **Create user personas** based on research
3. **Design wireframes** and user flows
4. **Set up development environment** and tools

### Long-term Strategy (3-12 months)
1. **Execute development** in iterative phases
2. **Conduct regular testing** and optimization
3. **Plan marketing** and user acquisition strategies
4. **Prepare for scaling** and future enhancements

## Why Choose Professional Development Services

While DIY solutions might seem attractive, professional development offers:

- **Expertise and Experience** - Avoid costly mistakes
- **Time Efficiency** - Faster time to market
- **Quality Assurance** - Professional testing and optimization
- **Ongoing Support** - Maintenance and updates
- **Local Market Knowledge** - Understanding of regional preferences

## Conclusion

${topic} in ${currentYear} requires a strategic approach that combines technical excellence with deep market understanding. Success depends on choosing the right partner who understands both global best practices and local market dynamics.

Our team at Softwhere has successfully delivered 100+ projects across Central Asia, helping businesses transform their digital presence and achieve measurable growth. We combine international expertise with local market knowledge to create solutions that truly resonate with your target audience.

**Ready to start your ${topic.toLowerCase()} journey?** Contact us today for a free consultation and discover how we can help transform your business with cutting-edge digital solutions tailored for the Central Asian market.

**Ready to get started?** Contact us today to discuss your project requirements and learn how we can help bring your vision to life.

*This article was written in ${currentYear} and reflects the latest industry trends and best practices.*`,

    ru: `# ${topic}: Полное руководство для ${currentYear} года

## Почему ${topic} важно в ${currentYear} году

Цифровой ландшафт ${currentYear} года кардинально изменил способы ведения бизнеса, особенно на развивающихся рынках, таких как Узбекистан и Центральная Азия. ${topic} стало критически важным для компаний, стремящихся оставаться конкурентоспособными и эффективно достигать своей целевой аудитории.

## Текущая рыночная ситуация

В ${currentYear} году мы наблюдаем беспрецедентный рост цифрового принятия в Центральной Азии. Согласно [Statista](https://www.statista.com/outlook/dmo/digital-media/central-asia), цифровой рынок в Центральной Азии ожидается рост на 15,2% ежегодно. Компании, инвестирующие в ${topic.toLowerCase()}, испытывают:

- **На 40% более высокую вовлеченность клиентов** по сравнению с традиционными подходами ([McKinsey Digital](https://www.mckinsey.com/capabilities/mckinsey-digital))
- **Расширенный охват рынка** за пределы географических границ
- **Улучшенную операционную эффективность** через цифровую трансформацию
- **Лучший ROI** на маркетинговые и развивающие инвестиции

## Комплексный анализ ${topic}

### Понимание основ

${topic} включает в себя несколько ключевых компонентов, которые работают вместе для создания успешных цифровых решений. Наш опыт работы с более чем 100+ клиентами в регионе показал, что успех зависит от:

1. **Стратегическое планирование** - Согласование технологий с бизнес-целями
2. **Пользователь-центричный дизайн** - Создание опыта, который резонирует с местными пользователями
3. **Техническое совершенство** - Внедрение надежных, масштабируемых решений
4. **Рыночная адаптация** - Понимание региональных предпочтений и поведения

### Стратегии внедрения

Основываясь на нашем обширном опыте на узбекском рынке, вот проверенные стратегии для ${topic.toLowerCase()}:

#### Фаза 1: Исследование и планирование
- Анализ рынка и исследование конкурентов
- Разработка пользовательских персон для центральноазиатских рынков
- Оценка технических требований
- Планирование бюджета и временных рамок

#### Фаза 2: Дизайн и разработка
- Дизайн пользовательского опыта с учетом культурных особенностей
- Планирование технической архитектуры
- Agile методология разработки
- Обеспечение качества и тестирование

#### Фаза 3: Запуск и оптимизация
- Мягкий запуск с выбранными группами пользователей
- Мониторинг производительности и аналитика
- Сбор и анализ отзывов пользователей
- Непрерывное улучшение и оптимизация

## Региональные рыночные инсайты

Центральноазиатский рынок, особенно Узбекистан, представляет уникальные возможности и вызовы:

### Возможности
- **Растущая цифровая грамотность** среди молодой демографии
- **Государственная поддержка** инициатив цифровой трансформации ([Всемирный банк](https://www.worldbank.org/en/topic/digitaldevelopment))
- **Увеличивающееся проникновение смартфонов** (85%+ в городских районах) ([GSMA Mobile Economy](https://www.gsma.com/mobileeconomy/))
- **Растущее принятие электронной коммерции** после пандемии ([eMarketer](https://www.emarketer.com/))

### Вызовы
- **Требования к языковой локализации** (узбекский, русский, английский)
- **Интеграция платежных систем** с местными банками
- **Культурная чувствительность** в дизайне и сообщениях
- **Инфраструктурные соображения** для сельских районов

## Лучшие практики для ${currentYear} года

### Технические соображения
- **Мобильно-первый подход** - 70% пользователей получают доступ к цифровым услугам через мобильные устройства
- **Прогрессивные веб-приложения** - Сочетание преимуществ веб и мобильных приложений
- **API-первая архитектура** - Обеспечение будущих интеграций и масштабируемости
- **Облачная инфраструктура** - Обеспечение надежности и производительности

### Принципы пользовательского опыта
- **Локализация за пределами перевода** - Культурная адаптация интерфейсов
- **Соответствие доступности** - Обеспечение инклюзивного дизайна
- **Оптимизация производительности** - Быстрое время загрузки для различных скоростей интернета
- **Офлайн функциональность** - Поддержка пользователей с ограниченным подключением

## Распространенные ошибки и как их избежать

### Технические ошибки
1. **Чрезмерная инженерия решений** - Держите это простым и масштабируемым
2. **Игнорирование мобильных пользователей** - Мобильно-первый подход является обязательным
3. **Плохая оптимизация производительности** - Скорость влияет на удержание пользователей
4. **Неадекватные меры безопасности** - Защитите данные пользователей и конфиденциальность

### Бизнес-ошибки
1. **Пропуск исследования рынка** - Понимайте свою местную аудиторию
2. **Недооценка локализации** - Язык и культура имеют значение
3. **Недостаточное тестирование** - Тестируйте с реальными пользователями в реальных условиях
4. **Пренебрежение поддержкой после запуска** - Обслуживание имеет решающее значение

## Инструменты и технологии для ${currentYear} года

### Фреймворки разработки
- **React Native / Flutter** - Кроссплатформенная мобильная разработка
- **Next.js / Nuxt.js** - Современные фреймворки веб-приложений
- **Node.js / Python** - Бэкенд разработка
- **PostgreSQL / MongoDB** - Решения баз данных

### Инструменты дизайна и аналитики
- **Figma / Adobe XD** - UI/UX дизайн
- **Google Analytics 4** - Продвинутая аналитика
- **Hotjar / Mixpanel** - Анализ поведения пользователей
- **Платформы A/B тестирования** - Инструменты оптимизации

## ROI и метрики успеха

Измерение успеха в ${topic.toLowerCase()} требует отслеживания правильных метрик:

### Ключевые показатели эффективности
- **Стоимость привлечения пользователей** (цель: <$10 для мобильных приложений)
- **Показатели удержания пользователей** (стремитесь к 30%+ через 30 дней)
- **Коэффициенты конверсии** (средний по отрасли: 2-5%)
- **Пожизненная ценность клиента** (должна превышать стоимость привлечения в 3 раза)

### Метрики бизнес-воздействия
- **Рост доходов** от цифровых каналов
- **Улучшения операционной эффективности**
- **Оценки удовлетворенности клиентов**
- **Расширение доли рынка**

## Будущие тренды и прогнозы

Глядя вперед в ${currentYear} году и далее:

### Emerging Technologies
- **AI and Machine Learning** integration
- **Voice interfaces** and conversational UI
- **Augmented Reality** experiences
- **Blockchain** for security and transparency

### Market Evolution
- **Super app ecosystems** gaining popularity
- **Social commerce** integration
- **Sustainability focus** in digital solutions
- **Privacy-first** design approaches

## Getting Started: Action Plan

### Immediate Steps (Week 1-2)
1. **Define clear objectives** and success metrics
2. **Conduct market research** specific to your industry
3. **Analyze competitors** and identify opportunities
4. **Set realistic budget** and timeline expectations

### Short-term Goals (Month 1-3)
1. **Develop detailed project plan** with milestones
2. **Create user personas** based on research
3. **Design wireframes** and user flows
4. **Set up development environment** and tools

### Long-term Strategy (3-12 months)
1. **Execute development** in iterative phases
2. **Conduct regular testing** and optimization
3. **Plan marketing** and user acquisition strategies
4. **Prepare for scaling** and future enhancements

## Why Choose Professional Development Services

While DIY solutions might seem attractive, professional development offers:

- **Экспертизу и опыт** - Избегайте дорогостоящих ошибок
- **Эффективность времени** - Быстрее выход на рынок
- **Обеспечение качества** - Профессиональное тестирование и оптимизация
- **Постоянную поддержку** - Обслуживание и обновления
- **Знание местного рынка** - Понимание региональных предпочтений

## Заключение

${topic} в ${currentYear} году требует стратегического подхода, который сочетает техническое совершенство с глубоким пониманием рынка. Успех зависит от выбора правильного партнера, который понимает как глобальные лучшие практики, так и динамику местного рынка.

Наша команда в Softwhere успешно реализовала 100+ проектов по всей Центральной Азии, помогая бизнесам трансформировать их цифровое присутствие и достигать измеримого роста. Мы сочетаем международную экспертизу с знанием местного рынка для создания решений, которые действительно резонируют с вашей целевой аудиторией.

**Готовы начать свое путешествие в ${topic.toLowerCase()}?** Свяжитесь с нами сегодня для бесплатной консультации и узнайте, как мы можем помочь трансформировать ваш бизнес с помощью передовых цифровых решений, адаптированных для центральноазиатского рынка.

**Готовы начать?** Свяжитесь с нами сегодня, чтобы обсудить требования вашего проекта и узнать, как мы можем помочь воплотить ваше видение в жизнь.

*Эта статья была написана в ${currentYear} году и отражает последние тенденции и лучшие практики отрасли.*`,

    uz: `# ${topic}: ${currentYear} yil uchun to'liq qo'llanma

## Nima uchun ${topic} ${currentYear} yilda muhim

${currentYear} yilning raqamli landshafti biznes yuritish usullarini tubdan o'zgartirdi, ayniqsa O'zbekiston va Markaziy Osiyo kabi rivojlanayotgan bozorlarda. ${topic} o'z maqsadli auditoriyasiga samarali yetib borish va raqobatbardosh bo'lib qolishga intilayotgan kompaniyalar uchun juda muhim bo'lib qoldi.

## Hozirgi bozor vaziyati

${currentYear} yilda biz Markaziy Osiyoda raqamli qabul qilishning misli ko'rilmagan o'sishini kuzatmoqdamiz. [Statista](https://www.statista.com/outlook/dmo/digital-media/central-asia) ma'lumotlariga ko'ra, Markaziy Osiyodagi raqamli bozor yiliga 15,2% o'sishi kutilmoqda. ${topic.toLowerCase()}ga sarmoya kiritayotgan kompaniyalar quyidagilarni boshdan kechirmoqda:

- **An'anaviy yondashuvlar bilan solishtirganda 40% yuqori mijozlar jalb qilish** ([McKinsey Digital](https://www.mckinsey.com/capabilities/mckinsey-digital))
- **Geografik chegaralardan tashqari kengaytirilgan bozor qamrovi**
- **Raqamli transformatsiya orqali yaxshilangan operatsion samaradorlik**
- **Marketing va rivojlantirish investitsiyalarida yaxshi ROI**

## ${topic}ning keng qamrovli tahlili

### Asoslarni tushunish

${topic} muvaffaqiyatli raqamli yechimlarni yaratish uchun birgalikda ishlaydigan bir nechta asosiy komponentlarni o'z ichiga oladi. Mintaqada 100+ mijozlar bilan ishlash tajribamiz shuni ko'rsatdiki, muvaffaqiyat quyidagilarga bog'liq:

1. **Strategik rejalashtirish** - Texnologiyalarni biznes maqsadlari bilan moslash
2. **Foydalanuvchi-markazlashtirilgan dizayn** - Mahalliy foydalanuvchilar bilan rezonans qiladigan tajriba yaratish
3. **Texnik mukammallik** - Ishonchli, kengaytiriladigan yechimlarni joriy etish
4. **Bozor moslashuvi** - Mintaqaviy afzalliklar va xatti-harakatlarni tushunish

### Joriy etish strategiyalari

O'zbekiston bozoridagi keng tajribamizga asoslanib, ${topic.toLowerCase()} uchun isbotlangan strategiyalar:

#### 1-bosqich: Tadqiqot va rejalashtirish
- Bozor tahlili va raqobatchilar tadqiqoti
- Markaziy Osiyo bozorlari uchun foydalanuvchi shaxslarini ishlab chiqish
- Texnik talablarni baholash
- Byudjet va vaqt jadvalini rejalashtirish

#### 2-bosqich: Dizayn va rivojlantirish
- Madaniy xususiyatlarni hisobga olgan holda foydalanuvchi tajribasi dizayni
- Texnik arxitektura rejalashtirish
- Agile rivojlantirish metodologiyasi
- Sifat kafolati va test qilish

#### 3-bosqich: Ishga tushirish va optimallashtirish
- Tanlangan foydalanuvchi guruhlari bilan yumshoq ishga tushirish
- Ishlash monitoring va analitika
- Foydalanuvchi fikr-mulohazalarini yig'ish va tahlil qilish
- Doimiy yaxshilash va optimallashtirish

## Mintaqaviy bozor tushunchalari

Markaziy Osiyo bozori, ayniqsa O'zbekiston, noyob imkoniyatlar va qiyinchiliklarni taqdim etadi:

### Imkoniyatlar
- **Yosh demografiya orasida o'sib borayotgan raqamli savodxonlik**
- **Raqamli transformatsiya tashabbuslariga davlat yordami** ([Jahon banki](https://www.worldbank.org/en/topic/digitaldevelopment))
- **Smartfonlarning ko'payib borayotgan penetratsiyasi** (shahar hududlarida 85%+) ([GSMA Mobile Economy](https://www.gsma.com/mobileeconomy/))
- **Pandemiyadan keyin elektron tijoratni qabul qilishning o'sishi** ([eMarketer](https://www.emarketer.com/))

### Qiyinchiliklar
- **Til lokalizatsiyasi talablari** (o'zbek, rus, ingliz)
- **Mahalliy banklar bilan to'lov tizimlarini integratsiyalash**
- **Dizayn va xabarlarda madaniy sezgirlik**
- **Qishloq hududlari uchun infratuzilma mulohazalari**

## ${currentYear} yil uchun eng yaxshi amaliyotlar

### Texnik mulohazalar
- **Mobil-birinchi yondashuv** - Foydalanuvchilarning 70% raqamli xizmatlarga mobil orqali kiradi
- **Progressiv veb-ilovalar** - Veb va mobil ilovalarning afzalliklarini birlashtirish
- **API-birinchi arxitektura** - Kelajakdagi integratsiyalar va kengaytirishni ta'minlash
- **Bulutli infratuzilma** - Ishonchlilik va ishlashni ta'minlash

### Foydalanuvchi tajribasi tamoyillari
- **Tarjimadan tashqari lokalizatsiya** - Interfeyslarning madaniy moslashuvi
- **Accessibility muvofiqlik** - Inklyuziv dizaynni ta'minlash
- **Ishlash optimallashtirish** - Turli internet tezliklari uchun tez yuklash vaqti
- **Oflayn funksionallik** - Cheklangan ulanishga ega foydalanuvchilarni qo'llab-quvvatlash

## Keng tarqalgan xatolar va ulardan qanday qochish kerak

### Texnik xatolar
1. **Yechimlarni haddan tashqari muhandislik qilish** - Oddiy va kengaytiriladigan qilib saqlang
2. **Mobil foydalanuvchilarni e'tiborsiz qoldirish** - Mobil-birinchi majburiy
3. **Yomon ishlash optimallashtirish** - Tezlik foydalanuvchilarni ushlab turishga ta'sir qiladi
4. **Noadekuat xavfsizlik choralari** - Foydalanuvchi ma'lumotlari va maxfiyligini himoya qiling

### Biznes xatolari
1. **Bozor tadqiqotini o'tkazib yuborish** - Mahalliy auditoriyangizni tushuning
2. **Lokalizatsiyani kam baholash** - Til va madaniyat muhim
3. **Yetarli test qilmaslik** - Haqiqiy sharoitlarda haqiqiy foydalanuvchilar bilan test qiling
4. **Ishga tushirishdan keyingi qo'llab-quvvatlashni e'tiborsiz qoldirish** - Texnik xizmat juda muhim

## ${currentYear} yil uchun vositalar va texnologiyalar

### Rivojlantirish freymvorklari
- **React Native / Flutter** - Cross-platform mobil rivojlantirish
- **Next.js / Nuxt.js** - Zamonaviy veb-ilova freymvorklari
- **Node.js / Python** - Backend rivojlantirish
- **PostgreSQL / MongoDB** - Ma'lumotlar bazasi yechimlari

### Dizayn va analitika vositalari
- **Figma / Adobe XD** - UI/UX dizayn
- **Google Analytics 4** - Ilg'or analitika
- **Hotjar / Mixpanel** - Foydalanuvchi xatti-harakatlari tahlili
- **A/B test platformalari** - Optimallashtirish vositalari

## ROI va muvaffaqiyat ko'rsatkichlari

${topic.toLowerCase()}da muvaffaqiyatni o'lchash to'g'ri ko'rsatkichlarni kuzatishni talab qiladi:

### Asosiy ishlash ko'rsatkichlari
- **Foydalanuvchi jalb qilish narxi** (maqsad: mobil ilovalar uchun <$10)
- **Foydalanuvchilarni ushlab turish ko'rsatkichlari** (30 kundan keyin 30%+ ga intiling)
- **Konversiya koeffitsientlari** (sanoat o'rtachasi: 2-5%)
- **Mijozning umr bo'yi qiymati** (jalb qilish narxidan 3 marta oshishi kerak)

### Biznes ta'siri ko'rsatkichlari
- **Raqamli kanallardan daromad o'sishi**
- **Operatsion samaradorlik yaxshilanishi**
- **Mijozlar qoniqish darajasi**
- **Bozor ulushini kengaytirish**

## Kelajakdagi tendentsiyalar va prognozlar

${currentYear} yil va undan keyingi davrlarga nazar tashlasak:

### Yangi texnologiyalar
- **AI va mashinani o'rganish integratsiyasi**
- **Ovozli interfeyslar** va suhbat UI
- **Kengaytirilgan haqiqat tajribasi**
- **Xavfsizlik va shaffoflik uchun blokcheyn**

### Bozor evolyutsiyasi
- **Super-ilova ekotizimlari** mashhurlik kasb etmoqda
- **Ijtimoiy tijorat integratsiyasi**
- **Raqamli yechimlarda barqarorlikka e'tibor**
- **Maxfiylikka yo'naltirilgan dizayn yondashuvlari**

## Boshlash: Harakat rejasi

### Darhol qadamlar (1-2 hafta)
1. **Aniq maqsadlarni belgilang** va muvaffaqiyat ko'rsatkichlari
2. **Sanoatingizga xos bozor tadqiqotini o'tkazing**
3. **Raqobatchilarni tahlil qiling** va imkoniyatlarni aniqlang
4. **Haqiqiy byudjet** va vaqt kutishlarini o'rnating

### Qisqa muddatli maqsadlar (1-3 oy)
1. **Bosqichlar bilan batafsil loyiha rejasini ishlab chiqing**
2. **Tadqiqotlar asosida foydalanuvchi shaxslarini yarating**
3. **Wireframe va foydalanuvchi oqimlarini loyihalash**
4. **Rivojlantirish muhiti va vositalarini o'rnating**

### Uzoq muddatli strategiya (3-12 oy)
1. **Iterativ bosqichlarda rivojlantirishni amalga oshiring**
2. **Muntazam test va optimallashtirish o'tkazing**
3. **Marketing va foydalanuvchi jalb qilish strategiyalarini rejalashtiring**
4. **Kengaytirish va kelajakdagi yaxshilanishlarga tayyorlaning**

## Nima uchun professional rivojlantirish xizmatlarini tanlash kerak

DIY yechimlari jozibali ko'rinishi mumkin bo'lsa-da, professional rivojlantirish quyidagilarni taklif qiladi:

- **Ekspertiza va tajriba** - Qimmat xatolardan saqlaning
- **Vaqt samaradorligi** - Bozorga tezroq chiqish
- **Sifat kafolati** - Professional test va optimallashtirish
- **Doimiy qo'llab-quvvatlash** - Texnik xizmat va yangilanishlar
- **Mahalliy bozor bilimi** - Mintaqaviy afzalliklarni tushunish

## Xulosa

${currentYear} yildagi ${topic} texnik mukammallik va chuqur bozor tushunchalarini birlashtirgan strategik yondashuvni talab qiladi. Muvaffaqiyat global eng yaxshi amaliyotlar va mahalliy bozor dinamikasini tushunadigan to'g'ri hamkorni tanlashga bog'liq.

Softwhere jamoamiz Markaziy Osiyo bo'ylab 100+ loyihani muvaffaqiyatli amalga oshirdi, bizneslarning raqamli mavjudligini o'zgartirishga va o'lchanadigan o'sishga erishishga yordam berdi. Biz maqsadli auditoriyangiz bilan haqiqatan ham rezonans qiladigan yechimlar yaratish uchun xalqaro ekspertizani mahalliy bozor bilimi bilan birlashtiramiz.

**${topic.toLowerCase()} sayohatingizni boshlashga tayyormisiz?** Bugun bepul maslahat uchun biz bilan bog'laning va Markaziy Osiyo bozori uchun moslashtirilgan ilg'or raqamli yechimlar bilan biznesingizni qanday o'zgartirishga yordam bera olishimizni bilib oling.

**Boshlashga tayyormisiz?** Loyiha talablaringizni muhokama qilish va tasavvuringizni hayotga tatbiq etishda qanday yordam bera olishimizni bilish uchun bugun biz bilan bog'laning.

*Ushbu maqola ${currentYear} yilda yozilgan va sohaning eng so'nggi tendentsiyalari va eng yaxshi amaliyotlarini aks ettiradi.*`,
  };

  return fallbackContent[locale as keyof typeof fallbackContent] || fallbackContent.en;
}

function createSlug(title: string): string {
  return (
    title
      .toLowerCase()
      // Keep letters (including Cyrillic), numbers, spaces, and hyphens
      // Using a more compatible approach for Cyrillic support
      .replace(
        /[^\u0041-\u005A\u0061-\u007A\u0410-\u044F\u0451\u0401\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u1C80-\u1C8F\u0030-\u0039\s-]/g,
        ''
      )
      // Replace spaces with hyphens
      .replace(/\s+/g, '-')
      // Remove multiple consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      .trim()
  );
}

const ALLOWED_LOCALES = ['en', 'ru', 'uz'];
const MAX_CUSTOM_TOPIC_LENGTH = 200;

export async function POST(request: NextRequest) {
  const authError = verifyApiSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { category, customTopic, locales = ['en', 'ru', 'uz'] } = body;

    if (!category && !customTopic) {
      return NextResponse.json({ error: 'Either category or customTopic is required' }, { status: 400 });
    }

    if (customTopic && typeof customTopic === 'string' && customTopic.length > MAX_CUSTOM_TOPIC_LENGTH) {
      return NextResponse.json({ error: `customTopic must be ${MAX_CUSTOM_TOPIC_LENGTH} characters or fewer` }, { status: 400 });
    }

    if (!Array.isArray(locales) || locales.length === 0 || locales.length > 3) {
      return NextResponse.json({ error: 'locales must be an array of 1-3 items' }, { status: 400 });
    }

    const invalidLocales = locales.filter((l: string) => !ALLOWED_LOCALES.includes(l));
    if (invalidLocales.length > 0) {
      return NextResponse.json({ error: `Invalid locales: ${invalidLocales.join(', ')}` }, { status: 400 });
    }

    await dbConnect();

    let selectedTopic: string;

    if (customTopic) {
      try {
        if (model) {
          const normalizePrompt = `You are a professional editor. Normalize this blog post topic by fixing spelling, improving grammar, and making it professional. Return ONLY the normalized topic, nothing else.

Topic: "${customTopic}"`;
          const normalizeResult = await model.generateContent(normalizePrompt);
          const normalized = (await normalizeResult.response).text().trim();
          if (normalized) {
            selectedTopic = normalized.replace(/^"|"$/g, '');
            console.log(`Normalized topic: "${customTopic}" -> "${selectedTopic}"`);
          } else {
            selectedTopic = customTopic;
          }
        } else {
          selectedTopic = customTopic;
        }
      } catch (error) {
        console.error('Error normalizing topic:', error);
        selectedTopic = customTopic;
      }
    } else {
      // If category is 'random', select from all categories
      if (category === 'random') {
        const allTopics = Object.values(BLOG_TOPICS).flat();

        selectedTopic = allTopics[Math.floor(Math.random() * allTopics.length)];
      } else {
        const topics = BLOG_TOPICS[category as keyof typeof BLOG_TOPICS];

        if (!topics) {
          return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }
        selectedTopic = topics[Math.floor(Math.random() * topics.length)];
      }
    }

    const generationGroupId = uuidv4();
    const createdPosts = [];

    // Fetch a cover image once for the entire generation group (Unsplash only)
    const coverImage = await getCoverImageForTopic(selectedTopic);

    // Generate posts for each requested locale
    for (const locale of locales) {
      try {
        const content = await generateBlogContent(selectedTopic, locale);

        // Generate localized title
        let localizedTitle = selectedTopic;

        if (locale !== 'en') {
          try {
            if (model) {
              const titlePrompt = `Translate the following blog post title into ${locale === 'ru' ? 'Russian' : 'Uzbek'}: "${selectedTopic}". Only return the translated title, nothing else.`;
              const titleResult = await model.generateContent(titlePrompt);
              const translatedTitle = (await titleResult.response).text().trim().replace(/^"|"$/g, '');

              if (translatedTitle) {
                localizedTitle = translatedTitle;
              }
            }
          } catch (titleError) {
            console.error(`Error translating title for ${locale}:`, titleError);
          }
        }

        const slug = `${createSlug(localizedTitle)}-${Date.now()}`;

        const blogPost = new BlogPost({
          title: localizedTitle,
          slug,
          content,
          status: 'draft',
          locale,
          generationGroupId,
          ...(coverImage && { coverImage }),
        });

        const savedPost = await blogPost.save();

        createdPosts.push({
          id: savedPost._id,
          title: savedPost.title,
          slug: savedPost.slug,
          locale: savedPost.locale,
          status: savedPost.status,
        });
      } catch (error) {
        console.error(`Error generating post for locale ${locale}:`, error);
        // Continue with other locales even if one fails
      }
    }

    if (createdPosts.length === 0) {
      return NextResponse.json({ error: 'Failed to generate any posts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${createdPosts.length} blog post(s)`,
      posts: createdPosts,
      generationGroupId,
    });
  } catch (error) {
    console.error('Error in blog generation:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
