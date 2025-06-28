import { ENV } from '@/constants';
import type { EstimatorInput } from '@/types/estimator';
import { logger } from '@/utils/logger';

export interface AIContentResult {
  success: boolean;
  data?: {
    title: string;
    content: string;
  };
  error?: string;
}

export interface AIEstimateResult {
  success: boolean;
  data?: {
    developmentCost: number;
    deadlineWeeks: number;
    supportCost: number;
    reasoning?: string;
  };
  error?: string;
}

export class AIManager {
  private googleApiKey: string | null;

  constructor() {
    this.googleApiKey = ENV.GOOGLE_API_KEY || null;
  }

  /**
   * Generate blog content using AI
   * @param topic - Blog topic
   * @param locale - Target locale
   * @returns AI content result
   */
  async generateBlogContent(topic: string, locale: string): Promise<AIContentResult> {
    try {
      if (!this.googleApiKey) {
        logger.warn('Google API key not available, using fallback content', undefined, 'AIManager');
        return this.generateFallbackContent(topic, locale);
      }

      logger.info(`Generating AI content for topic: "${topic}" in locale: ${locale}`, undefined, 'AIManager');

      const prompt = this.buildContentPrompt(topic, locale);
      const response = await this.callGeminiAPI(prompt);

      if (!response.success) {
        logger.warn('AI generation failed, using fallback', response.error, 'AIManager');
        return this.generateFallbackContent(topic, locale);
      }

      const content = this.parseAIResponse(response.data);
      if (!content) {
        logger.warn('AI response parsing failed, using fallback', undefined, 'AIManager');
        return this.generateFallbackContent(topic, locale);
      }

      logger.info(`Successfully generated AI content for "${topic}"`, undefined, 'AIManager');

      return {
        success: true,
        data: content,
      };
    } catch (error) {
      logger.error('AI content generation error', error, 'AIManager');
      return this.generateFallbackContent(topic, locale);
    }
  }

  /**
   * Get available blog categories
   * @returns Array of category names
   */
  getAvailableCategories(): string[] {
    return ['mobile-app-development', 'telegram-development', 'web-development', 'business-strategy'];
  }

  /**
   * Get topics for a specific category
   * @param category - Category name
   * @returns Array of topics or null if category not found
   */
  getTopicsForCategory(category: string): string[] | null {
    const blogTopics: Record<string, string[]> = {
      'mobile-app-development': [
        'Complete Guide to Mobile App Development in 2024',
        'Native vs Hybrid vs Cross-Platform: Which is Right for Your Business?',
        'iOS vs Android Development: Cost, Timeline, and Market Considerations',
        'Mobile App UI/UX Design Trends That Drive User Engagement',
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
        'Monetizing Telegram Bots: Revenue Strategies for 2024',
        'Telegram Mini Apps: The Future of In-App Experiences',
        'Building E-commerce Solutions with Telegram Bots',
        'Telegram Bot Security: Protecting Your Business and Users',
        'Advanced Telegram Bot Features: Payments, Webhooks, and More',
        'Telegram Bot vs WhatsApp Business: Which is Better for Your Business?',
        'Creating Interactive Telegram Mini Apps with Web Technologies',
      ],
      'web-development': [
        'Modern Web Development: Frameworks and Technologies in 2024',
        'Progressive Web Apps (PWA): The Future of Web Development',
        'Website Performance Optimization: Speed Up Your Site',
        'Responsive Web Design: Best Practices for All Devices',
        'Next.js vs React: Choosing the Right Framework for Your Project',
        'Web Development Cost Breakdown: What You Need to Budget',
        'SEO-Friendly Web Development: Technical Best Practices',
        'Web Accessibility: Building Inclusive Digital Experiences',
        'E-commerce Website Development: Features That Drive Sales',
        'Web Development Trends That Will Shape 2024',
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

    return blogTopics[category] || null;
  }

  /**
   * Get a random topic for a category
   * @param category - Category name
   * @returns Random topic or null if category not found
   */
  getRandomTopicForCategory(category: string): string | null {
    const topics = this.getTopicsForCategory(category);
    if (!topics || topics.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * topics.length);
    return topics[randomIndex];
  }

  /**
   * Build prompt for AI content generation
   * @param topic - Blog topic
   * @param locale - Target locale
   * @returns Formatted prompt
   */
  private buildContentPrompt(topic: string, locale: string): string {
    const languageMap: Record<string, string> = {
      en: 'English',
      ru: 'Russian',
      uz: 'Uzbek',
    };

    const language = languageMap[locale] || 'English';

    return `
      You are an expert content writer for a software development agency called "Softwhere" based in Uzbekistan.

      Write a comprehensive blog post in ${language} about: "${topic}"

      Requirements:
      - Write in ${language} language
      - Target audience: Business owners and decision-makers considering software development
      - Focus on Uzbekistan/Central Asia market context when relevant
      - Include practical insights and actionable advice
      - Mention our expertise in mobile apps, web development, and Telegram bots when appropriate
      - Length: 2000-3000 words
      - Professional, authoritative tone
      - Include real-world examples and case studies
      - End with a call-to-action to contact Softwhere for development services

      Structure your response as JSON with two fields:
      {
        "title": "Engaging title for the blog post",
        "content": "Full blog post content in markdown format"
      }

      Make sure the JSON is valid and properly escaped.
    `;
  }

  /**
   * Call Gemini API for content generation
   * @param prompt - Content prompt
   * @returns API response
   */
  private async callGeminiAPI(prompt: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.googleApiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error('Empty response from Gemini API');
      }

      return {
        success: true,
        data: content,
      };
    } catch (error) {
      logger.error('Gemini API call failed', error, 'AIManager');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI API call failed',
      };
    }
  }

  /**
   * Parse AI response to extract title and content
   * @param rawResponse - Raw AI response
   * @returns Parsed content or null
   */
  private parseAIResponse(rawResponse: string): { title: string; content: string } | null {
    try {
      // Try to extract JSON from the response
      let jsonStr = rawResponse.trim();

      // Handle markdown code blocks
      const jsonMatch = rawResponse.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      if (parsed.title && parsed.content && typeof parsed.title === 'string' && typeof parsed.content === 'string') {
        return {
          title: parsed.title.trim(),
          content: parsed.content.trim(),
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to parse AI response', error, 'AIManager');
      return null;
    }
  }

  /**
   * Generate project estimate using AI
   * @param input - Estimator input data
   * @returns AI estimate result
   */
  async generateProjectEstimate(input: EstimatorInput): Promise<AIEstimateResult> {
    try {
      if (!this.googleApiKey) {
        logger.warn('Google API key not available for estimate generation', undefined, 'AIManager');
        return {
          success: false,
          error: 'AI estimation not available - API key not configured',
        };
      }

      logger.info('Generating AI project estimate', input, 'AIManager');

      const prompt = this.buildEstimatePrompt(input);
      const response = await this.callGeminiAPI(prompt);

      if (!response.success) {
        logger.warn('AI estimate generation failed', response.error, 'AIManager');
        return {
          success: false,
          error: response.error,
        };
      }

      const estimate = this.parseEstimateResponse(response.data);
      if (!estimate) {
        logger.warn('AI estimate parsing failed', undefined, 'AIManager');
        return {
          success: false,
          error: 'Failed to parse AI estimate response',
        };
      }

      logger.info('Successfully generated AI project estimate', estimate, 'AIManager');

      return {
        success: true,
        data: estimate,
      };
    } catch (error) {
      logger.error('AI project estimate generation error', error, 'AIManager');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI estimation failed',
      };
    }
  }

  /**
   * Build prompt for AI project estimation
   * @param input - Estimator input
   * @returns Formatted prompt
   */
  private buildEstimatePrompt(input: EstimatorInput): string {
    return `
      As an expert software development cost estimator, provide a JSON estimate for the following project:

      Project Type: ${input.projectType}
      ${input.projectType === 'mobile' && input.platforms ? `Platforms: ${input.platforms.join(', ')}` : ''}
      Complexity Level: ${input.complexity}
      Features: ${input.features?.join(', ') || 'None selected'}
      Number of Pages/Screens: ${input.pages}
      ${input.techStack ? `Tech Stack Preference: ${input.techStack.join(', ')}` : ''}

      Please return only a valid JSON object with the following fields:
      - developmentCost (in USD as a number, not a string)
      - deadlineWeeks (as a number)
      - supportCost (in USD as a number, not a string)
      - reasoning (brief explanation of how you arrived at the estimate)

      Base your pricing on industry standards for quality work done by professional developers.
      Consider the Uzbekistan/Central Asia market context for competitive pricing.

      Important: All monetary values must be numbers, not strings with currency symbols.
    `;
  }

  /**
   * Parse AI estimate response
   * @param rawResponse - Raw AI response
   * @returns Parsed estimate or null
   */
  private parseEstimateResponse(rawResponse: string): {
    developmentCost: number;
    deadlineWeeks: number;
    supportCost: number;
    reasoning?: string;
  } | null {
    try {
      // Try to extract JSON from the response
      let jsonStr = rawResponse.trim();

      // Handle markdown code blocks
      const jsonMatch = rawResponse.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      // Extract and validate numbers
      const extractNumber = (value: any): number => {
        if (typeof value === 'number' && !isNaN(value)) {
          return value;
        }

        if (typeof value === 'string') {
          // Remove non-numeric characters except decimal point
          const cleanedStr = value.replace(/[^0-9.]/g, '');
          const parsedValue = parseFloat(cleanedStr);
          return isNaN(parsedValue) ? 0 : parsedValue;
        }

        return 0;
      };

      const developmentCost = extractNumber(parsed.developmentCost);
      const deadlineWeeks = extractNumber(parsed.deadlineWeeks);
      const supportCost = extractNumber(parsed.supportCost);

      // Validate estimates are reasonable
      if (developmentCost <= 0 || deadlineWeeks <= 0 || supportCost < 0) {
        return null;
      }

      return {
        developmentCost: Math.round(developmentCost),
        deadlineWeeks: Math.round(deadlineWeeks),
        supportCost: Math.round(supportCost),
        reasoning: parsed.reasoning || 'AI-powered estimate based on project parameters.',
      };
    } catch (error) {
      logger.error('Failed to parse AI estimate response', error, 'AIManager');
      return null;
    }
  }

  /**
   * Generate fallback content when AI is not available
   * @param topic - Blog topic
   * @param locale - Target locale
   * @returns Fallback content result
   */
  private generateFallbackContent(topic: string, locale: string): AIContentResult {
    const languageContent: Record<string, { title: string; content: string }> = {
      en: {
        title: `${topic} - Expert Insights from Softwhere`,
        content: `# ${topic}

At Softwhere, we understand the importance of ${topic.toLowerCase()} in today's digital landscape. Our team of experienced developers has been helping businesses in Uzbekistan and Central Asia achieve their digital transformation goals.

## Why This Matters for Your Business

In the rapidly evolving world of technology, staying ahead of the curve is crucial for business success. ${topic} represents a significant opportunity for companies looking to innovate and grow.

## Our Approach

At Softwhere, we take a comprehensive approach to software development:

- **Mobile App Development**: Native iOS and Android apps that deliver exceptional user experiences
- **Web Development**: Modern, responsive websites built with cutting-edge technologies
- **Telegram Bot Development**: Automated solutions that enhance customer engagement
- **Consulting Services**: Strategic guidance to help you make informed technology decisions

## Key Benefits

When you work with our team, you can expect:

1. **Expert Technical Knowledge**: Our developers stay current with the latest technologies and best practices
2. **Local Market Understanding**: We understand the unique needs of businesses in Uzbekistan and Central Asia
3. **Quality Assurance**: Rigorous testing ensures your applications work flawlessly
4. **Ongoing Support**: We provide maintenance and updates to keep your solutions running smoothly

## Getting Started

Ready to discuss your project? Our team is here to help you turn your ideas into reality. We offer free consultations to understand your needs and provide tailored recommendations.

## Contact Softwhere Today

Let's build something amazing together. Contact us to learn more about how we can help your business succeed in the digital world.

**Phone**: +998332499111
**Email**: kamuranbek98@gmail.com`,
      },
      ru: {
        title: `${topic} - Экспертные решения от Softwhere`,
        content: `# ${topic}

В Softwhere мы понимаем важность ${topic.toLowerCase()} в современном цифровом мире. Наша команда опытных разработчиков помогает бизнесу в Узбекистане и Центральной Азии достигать целей цифровой трансформации.

## Почему это важно для вашего бизнеса

В быстро развивающемся мире технологий важно оставаться на шаг впереди конкурентов. ${topic} представляет значительную возможность для компаний, стремящихся к инновациям и росту.

## Наш подход

В Softwhere мы применяем комплексный подход к разработке программного обеспечения:

- **Разработка мобильных приложений**: Нативные iOS и Android приложения с исключительным пользовательским опытом
- **Веб-разработка**: Современные, адаптивные веб-сайты на передовых технологиях
- **Разработка Telegram ботов**: Автоматизированные решения для улучшения взаимодействия с клиентами
- **Консалтинговые услуги**: Стратегическое руководство для принятия обоснованных технологических решений

## Ключевые преимущества

Работая с нашей командой, вы получаете:

1. **Экспертные технические знания**: Наши разработчики следят за последними технологиями и лучшими практиками
2. **Понимание местного рынка**: Мы понимаем уникальные потребности бизнеса в Узбекистане и Центральной Азии
3. **Контроль качества**: Тщательное тестирование обеспечивает безупречную работу ваших приложений
4. **Постоянная поддержка**: Мы предоставляем обслуживание и обновления для бесперебойной работы решений

## Начало работы

Готовы обсудить ваш проект? Наша команда поможет воплотить ваши идеи в реальность. Мы предлагаем бесплатные консультации для понимания ваших потребностей и предоставления индивидуальных рекомендаций.

## Свяжитесь с Softwhere сегодня

Давайте создадим что-то удивительное вместе. Свяжитесь с нами, чтобы узнать больше о том, как мы можем помочь вашему бизнесу добиться успеха в цифровом мире.

**Телефон**: +998332499111
**Email**: kamuranbek98@gmail.com`,
      },
      uz: {
        title: `${topic} - Softwhere dan mutaxassis yechimlari`,
        content: `# ${topic}

Softwhere kompaniyasida biz zamonaviy raqamli dunyoda ${topic.toLowerCase()} muhimligini tushunamiz. Tajribali dasturchilerimiz jamoasi O'zbekiston va Markaziy Osiyo bizneslariga raqamli transformatsiya maqsadlariga erishishda yordam beradi.

## Nega bu sizning biznesingiz uchun muhim

Tez rivojlanayotgan texnologiyalar dunyosida raqobatchilardan oldinda bo'lish muhimdir. ${topic} innovatsiya va o'sishga intilayotgan kompaniyalar uchun muhim imkoniyatni anglatadi.

## Bizning yondashuvimiz

Softwhereda biz dasturiy ta'minot ishlab chiqishga kompleks yondashuvni qo'llaymiz:

- **Mobil ilova ishlab chiqish**: Ajoyib foydalanuvchi tajribasini taqdim etuvchi native iOS va Android ilovalar
- **Veb ishlab chiqish**: Zamonaviy texnologiyalar asosida qurilgan zamonaviy, moslashuvchan veb-saytlar
- **Telegram bot ishlab chiqish**: Mijozlar bilan muloqotni yaxshilaydigan avtomatik yechimlar
- **Konsalting xizmatlari**: Asosli texnologik qarorlar qabul qilish uchun strategik yo'l-yo'riq

## Asosiy afzalliklar

Bizning jamoa bilan ishlashda siz quyidagilarni olasiz:

1. **Ekspert texnik bilim**: Bizning dasturchilar eng so'nggi texnologiyalar va eng yaxshi amaliyotlarni kuzatib boradilar
2. **Mahalliy bozorni tushunish**: Biz O'zbekiston va Markaziy Osiyodagi biznesning noyob ehtiyojlarini tushunamiz
3. **Sifat nazorati**: Sinchkovlik bilan test qilish ilovalaringizning mukammal ishlashini ta'minlaydi
4. **Doimiy qo'llab-quvvatlash**: Biz yechimlaringizning uzluksiz ishlashi uchun xizmat ko'rsatish va yangilanishlarni taqdim etamiz

## Ish boshlash

Loyihangizni muhokama qilishga tayyormisiz? Bizning jamoa g'oyalaringizni haqiqatga aylantirish uchun yordam beradi. Biz ehtiyojlaringizni tushunish va individual tavsiyalar berish uchun bepul maslahatlar taklif qilamiz.

## Bugun Softwhere bilan bog'laning

Keling, birgalikda ajoyib narsa yarataylik. Raqamli dunyoda biznesingizning muvaffaqiyatga erishishiga qanday yordam bera olishimiz haqida ko'proq bilish uchun biz bilan bog'laning.

**Telefon**: +998332499111
**Email**: kamuranbek98@gmail.com`,
      },
    };

    const content = languageContent[locale] || languageContent['en'];

    return {
      success: true,
      data: content,
    };
  }
}
