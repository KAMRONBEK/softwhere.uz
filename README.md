# 🚀 Softwhere.uz - Modern Software Development Agency Platform

A comprehensive Next.js platform for Softwhere, a software development agency based in Uzbekistan, featuring advanced blog management, AI-powered content generation, project estimation, and multi-language support.

> **Built using [Arno's Next.js Architecture Guide](https://arno.surfacew.com/posts/nextjs-architecture)** - A production-ready layered architecture with Domain-Driven Design principles.

## 🏗️ **Architecture Overview**

This project implements a **5-layer architecture pattern** following Domain-Driven Design (DDD) principles, ensuring maintainability, scalability, and clear separation of concerns.

### **Architecture Diagram**

```mermaid
graph TD
    subgraph "Client Layer"
        A[React Components]
        B[Next.js Pages]
        C[API Client]
    end

    subgraph "Controller Layer"
        D[API Routes]
        E[Server Actions]
        F[Middleware]
    end

    subgraph "Service Layer"
        G[BlogService]
        H[AdminService]
        I[GenerationService]
        J[EstimatorService]
    end

    subgraph "Manager Layer"
        K[BlogManager]
        L[ValidationManager]
        M[AIManager]
        N[EstimatorManager]
    end

    subgraph "Data Layer"
        O[MongoDB Models]
        P[Database Connection]
        Q[External APIs]
    end

    A --> D
    B --> D
    C --> D
    D --> G
    D --> H
    D --> I
    D --> J
    G --> K
    G --> L
    H --> K
    H --> L
    I --> K
    I --> L
    I --> M
    J --> M
    J --> N
    J --> L
    K --> O
    K --> P
    M --> Q
    N --> P

    style A fill:#e1f5fe
    style G fill:#e8f5e8
    style K fill:#fff3e0
    style O fill:#ffebee
```

### **Layer Responsibilities**

#### **🎨 Client Layer**

- **React Components**: UI components with proper separation of concerns
- **Next.js Pages**: Route handling and server-side rendering
- **API Client**: Centralized HTTP client with error handling and logging

#### **🎛️ Controller Layer**

- **API Routes**: Thin controllers that delegate to services (zero business logic)
- **Server Actions**: Form handling and server-side operations
- **Middleware**: Authentication, logging, and request processing

#### **🔧 Service Layer**

- **Domain Services**: Business logic encapsulation and orchestration
- **Cross-cutting Concerns**: Validation, error handling, logging
- **External Integrations**: AI services, email services, third-party APIs

#### **⚙️ Manager Layer**

- **Data Operations**: CRUD operations and data transformation
- **Reusable Logic**: Shared business logic components
- **External APIs**: Direct integration with databases and external services

#### **💾 Data Layer**

- **Database Models**: MongoDB schemas and data access
- **External APIs**: Google AI, email services, payment processors
- **File Storage**: Static assets and media management

## 🚀 **Quick Start**

### **Prerequisites**

- Node.js 18.17 or later
- MongoDB database (local or cloud)
- Google AI API key (optional, for AI features)
- Yarn package manager

### **Installation**

```bash
# Clone the repository
git clone https://github.com/your-username/softwhere.uz.git
cd softwhere.uz

# Install dependencies
yarn install

# Set up environment variables
cp env.example .env.local
# Edit .env.local with your configuration

# Start development server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### **Environment Configuration**

```env
# Required - Database
MONGODB_URI=mongodb://localhost:27017/softwhere

# Required - Security
NEXTAUTH_SECRET=your-nextauth-secret
API_SECRET=your-api-secret

# Optional - AI Features
GOOGLE_API_KEY=your-google-ai-key
OPENAI_API_KEY=your-openai-key

# Optional - Development
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 📁 **Project Structure**

```
src/
├── app/                    # Next.js 13+ App Router (Controller Layer)
│   ├── [locale]/          # Internationalized routes
│   │   ├── admin/         # Admin panel with CRUD operations
│   │   ├── blog/          # Blog pages with SEO optimization
│   │   └── estimator/     # AI-powered project estimator
│   └── api/               # API routes (thin controllers)
│       ├── admin/         # Admin management APIs
│       ├── blog/          # Blog content APIs
│       └── estimate/      # Project estimation APIs
│
├── services/              # 🔧 Service Layer (Business Logic)
│   ├── blog.service.ts    # Blog content management
│   ├── admin.service.ts   # Admin operations
│   ├── generation.service.ts # AI content generation
│   └── estimator.service.ts  # Project cost estimation
│
├── managers/              # ⚙️ Manager Layer (Data Operations)
│   ├── blog.manager.ts    # Blog database operations
│   ├── validation.manager.ts # Input validation & sanitization
│   ├── ai.manager.ts      # AI service integrations
│   └── estimator.manager.ts  # Estimation calculations
│
├── components/            # UI Components
│   ├── Header/            # Navigation with scroll behavior
│   ├── sections/          # Page sections (Hero, Services, etc.)
│   ├── Estimator/         # Project estimation wizard
│   └── AdminComponents/   # Admin panel components
│
├── utils/                 # Utilities and Helpers
│   ├── api.ts            # Centralized HTTP client
│   ├── logger.ts         # Structured logging system
│   └── env.ts            # Environment validation
│
├── constants/             # Configuration Constants
│   ├── index.ts          # General app constants
│   └── estimator.ts      # Estimation parameters
│
├── types/                 # TypeScript Interfaces
│   ├── index.ts          # Common types
│   └── estimator.ts      # Estimation types
│
└── models/                # Database Models
    └── BlogPost.ts       # MongoDB blog post schema
```

## 🎯 **Key Features**

### **📝 AI-Powered Blog System**

- **Multi-language Support**: Uzbek, Russian, English with proper i18n
- **AI Content Generation**: Google Gemini integration for automated posts
- **SEO Optimization**: Meta tags, OpenGraph, structured data, sitemap
- **Admin Interface**: Full CRUD operations with rich text editing
- **Content Relationships**: Cross-language post linking via generationGroupId

### **💰 Smart Project Estimator**

- **AI-Enhanced Estimates**: Google Gemini for intelligent project analysis
- **Formula-Based Fallback**: Reliable mathematical estimation model
- **Multi-Platform Support**: Web, mobile (iOS/Android), Telegram bots
- **Feature-Based Pricing**: Granular cost breakdown by features
- **Quote Management**: Save and track customer inquiries

### **🔒 Enterprise Security**

- **Secret Admin Access**: Hidden admin panel (5-click activation sequence)
- **Input Validation**: Comprehensive sanitization at service boundaries
- **Environment Validation**: Startup configuration verification
- **Structured Logging**: Security event monitoring and audit trails
- **Rate Limiting**: API protection against abuse

### **🌐 Advanced Internationalization**

- **Next-Intl Integration**: Professional i18n implementation
- **Dynamic Language Switching**: Seamless locale transitions
- **Smart Content Routing**: Related content discovery across languages
- **SEO-Friendly URLs**: Localized paths with proper canonical tags

### **📊 Performance & Monitoring**

- **Structured Logging**: Context-aware logging with performance metrics
- **Database Optimization**: Connection pooling and query optimization
- **API Response Caching**: Intelligent caching strategies
- **Health Monitoring**: Database and service status endpoints

## 🔮 **Future Development Roadmap**

### **Phase 9: Contact Service Enhancement**

- Contact form processing with service layer
- Email sending operations via dedicated manager
- Form validation and spam protection
- Email template management

### **Phase 10: Authentication System**

- Service-based authentication logic
- Session management with proper security
- Admin user management interface
- Role-based access control

### **Phase 11: Testing Infrastructure**

- Unit tests for all services and managers
- Integration tests for API routes
- E2E tests for critical user flows
- Automated test coverage reporting

### **Phase 12: Performance Optimizations**

- Redis caching layer implementation
- Database query optimization with indexes
- API rate limiting and throttling
- Response compression and CDN integration

### **Phase 13: Monitoring & Analytics**

- Error tracking with Sentry integration
- Performance monitoring dashboard
- API analytics and usage metrics
- Real-time health check endpoints

### **Phase 14: Advanced Features**

- Real-time notifications system
- File upload service with cloud storage
- Content versioning and history
- Advanced search functionality

## 🛠️ **Development Guidelines**

### **Architecture Principles**

1. **Layered Architecture**: Strict separation of concerns across 5 layers
2. **Domain-Driven Design**: Business logic encapsulated in services
3. **Dependency Injection**: Clean dependency management
4. **Error Handling**: Consistent error patterns with structured logging
5. **Type Safety**: Comprehensive TypeScript coverage
6. **Testing**: Unit and integration tests for all layers

### **Code Standards**

```typescript
// ✅ Good: Use service layer
import { blogService } from '@/services/blog.service';

const result = await blogService.getPublishedPosts({ locale: 'en' });
if (result.success) {
  const posts = result.data;
}

// ❌ Bad: Direct database access in controllers
const posts = await BlogPost.find({ status: 'published' });
```

```typescript
// ✅ Good: Use structured logging
import { logger } from '@/utils/logger';

logger.info('Operation started', { userId, locale }, 'BlogService');
logger.performance('Database query', duration, 'BlogManager');

// ❌ Bad: Console logging
console.log('Operation started');
```

```typescript
// ✅ Good: Consistent error handling
const result = await service.operation(params);
if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}

// ❌ Bad: Throwing unhandled errors
throw new Error('Something went wrong');
```

### **Service Layer Pattern**

```typescript
export class BlogService {
  private blogManager: BlogManager;
  private validationManager: ValidationManager;

  constructor() {
    this.blogManager = new BlogManager();
    this.validationManager = new ValidationManager();
  }

  async getPost(slug: string, locale: string): Promise<ServiceResult<BlogPost>> {
    try {
      // 1. Input validation
      const validation = this.validationManager.validatePostQuery(slug, locale);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // 2. Business logic
      const post = await this.blogManager.getPostBySlug(slug, locale);

      if (!post) {
        return { success: false, error: 'Post not found' };
      }

      // 3. Return consistent format
      return { success: true, data: post };
    } catch (error) {
      logger.error('Failed to get post', error, 'BlogService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get post',
      };
    }
  }
}
```

## 🧪 **Testing Strategy**

### **Unit Testing**

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run tests in watch mode
yarn test:watch
```

### **Service Testing Example**

```typescript
describe('BlogService', () => {
  let blogService: BlogService;
  let mockBlogManager: jest.Mocked<BlogManager>;

  beforeEach(() => {
    mockBlogManager = new BlogManager() as jest.Mocked<BlogManager>;
    blogService = new BlogService();
    (blogService as any).blogManager = mockBlogManager;
  });

  it('should return post successfully', async () => {
    const mockPost = { title: 'Test Post', slug: 'test-post' };
    mockBlogManager.getPostBySlug.mockResolvedValue(mockPost);

    const result = await blogService.getPost('test-post', 'en');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockPost);
  });
});
```

## 🚀 **Deployment**

### **Vercel (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod

# Set environment variables
vercel env add MONGODB_URI
vercel env add GOOGLE_API_KEY
```

### **Docker Deployment**

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

EXPOSE 3000
CMD ["yarn", "start"]
```

### **Environment Variables**

```bash
# Production deployment
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/softwhere
GOOGLE_API_KEY=your-production-key
API_SECRET=strong-production-secret
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

## 📊 **Performance Optimizations**

- **Server Components**: Reduced client-side JavaScript bundle
- **Image Optimization**: Next.js Image component with lazy loading
- **Code Splitting**: Automatic bundle optimization and tree shaking
- **Database Indexing**: Optimized MongoDB queries with proper indexes
- **Caching Strategy**: API response caching and incremental static regeneration
- **SEO Optimization**: Meta tags, structured data, and sitemap generation

## 🔧 **Development Tools**

### **Available Scripts**

```bash
# Development
yarn dev              # Start development server
yarn build            # Build for production
yarn start            # Start production server
yarn lint             # Lint codebase
yarn type-check       # TypeScript type checking
yarn test             # Run tests
yarn test:coverage    # Run tests with coverage
yarn format           # Format code with Prettier

# Database
yarn db:connect       # Test database connection
yarn db:seed          # Seed database with sample data

# Utilities
yarn analyze          # Analyze bundle size
yarn normalize-line-endings  # Fix line endings
```

### **Development Environment**

- **TypeScript**: Full type safety with strict mode
- **ESLint**: Code quality and architecture boundary enforcement
- **Prettier**: Consistent code formatting
- **Husky**: Git hooks for quality gates
- **Jest**: Unit and integration testing
- **MongoDB**: Document database with Mongoose ODM

## 📚 **Documentation**

- **[Architecture Guide](docs/architecture.md)**: Detailed architecture documentation
- **[Architecture Examples](ARCHITECTURE_EXAMPLES.md)**: Implementation patterns and examples
- **[Architecture Roadmap](ARCHITECTURE_ROADMAP.md)**: Development progress and future plans
- **[Cursor Rules](.cursorrules)**: Development guidelines and standards
- **[API Documentation](docs/api.md)**: API endpoints and usage

## 🤝 **Contributing**

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/new-feature`
3. **Follow architecture patterns**: Use layered architecture strictly
4. **Add comprehensive tests**: Unit and integration tests required
5. **Update documentation**: Keep docs current with changes
6. **Submit pull request**: Include detailed description and tests

### **Code Review Checklist**

- [ ] Follows 5-layer architecture pattern
- [ ] Uses proper TypeScript interfaces
- [ ] Includes comprehensive error handling
- [ ] Has structured logging with context
- [ ] Validates inputs at service boundaries
- [ ] Updates tests and maintains coverage
- [ ] Documents API changes

### **Development Standards**

- **Architecture**: Follow service/manager layer separation
- **Error Handling**: Use ServiceResult pattern consistently
- **Logging**: Include context and performance metrics
- **Validation**: Validate at service boundaries
- **Testing**: Maintain 80%+ test coverage
- **Documentation**: Update inline and external docs

## 🌟 **Key Benefits**

### **Developer Experience**

- **Clear Architecture**: Easy to understand and extend
- **Type Safety**: Comprehensive TypeScript coverage
- **Fast Development**: Established patterns and utilities
- **Easy Testing**: Isolated, testable components
- **Good Documentation**: Comprehensive guides and examples

### **Production Ready**

- **Scalable Architecture**: Handles growth and complexity
- **Performance Optimized**: Fast loading and responsive
- **SEO Friendly**: Proper meta tags and structured data
- **Secure**: Input validation and security best practices
- **Maintainable**: Clean code and clear separation of concerns

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 📞 **Contact**

**Softwhere Development Team**

- **Website**: [softwhere.uz](https://softwhere.uz)
- **Email**: kamuranbek98@gmail.com
- **Phone**: +998332499111
- **Location**: Tashkent, Uzbekistan

---

**Built with ❤️ in Uzbekistan using [Arno's Next.js Architecture Guide](https://arno.surfacew.com/posts/nextjs-architecture) and modern web technologies.**

## 🔄 **Line Endings Configuration**

This project uses LF line endings for consistency across platforms:

```bash
# Set Git configuration
git config --local core.autocrlf false

# Normalize line endings after cloning
yarn normalize-line-endings

# Format code if needed
yarn format
```

---

> **Architecture Note**: This project successfully implements Arno's recommended layered architecture pattern with 5 distinct layers, ensuring maintainability, testability, and scalability. Each layer has a single responsibility and clear interfaces, making the codebase easy to understand and extend.
