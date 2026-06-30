export interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  content?: string;
  status: 'draft' | 'published';
  locale: 'en' | 'ru' | 'uz';
  generationGroupId?: string;
  coverImage?: { url: string; thumbUrl: string; authorName: string; authorUrl: string; keyword: string };
  createdAt: string;
  updatedAt: string;
}

export interface PostGroup {
  generationGroupId: string;
  posts: BlogPost[];
  createdAt: string;
  status: 'draft' | 'published' | 'mixed';
}

export interface GenerationRequest {
  category?: string;
  customTopic?: string;
  sourceUrl?: string;
  sourceText?: string;
  locales: string[];
}
