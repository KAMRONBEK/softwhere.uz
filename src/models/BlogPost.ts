import mongoose, { Schema, Document, Model } from 'mongoose';

// Define the structure of a BlogPost document
export interface ICoverImage {
  url: string;
  thumbUrl: string;
  authorName: string;
  authorUrl: string;
  keyword: string;
}

export interface IBlogPost extends Document {
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published';
  locale: 'en' | 'ru' | 'uz';
  generationGroupId?: string;
  coverImage?: ICoverImage;
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
  {
    title: {
      type: String,
      required: [true, 'Title is required.'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required.'],
      index: true,
    },
    content: {
      type: String, // Storing Markdown content
      required: [true, 'Content is required.'],
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    locale: {
      type: String,
      enum: ['en', 'ru', 'uz'],
      required: [true, 'Locale is required.'],
      index: true,
    },
    generationGroupId: {
      type: String,
      index: true,
      sparse: true,
    },
    coverImage: {
      url: String,
      thumbUrl: String,
      authorName: String,
      authorUrl: String,
      keyword: String,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  }
);

// Add compound index for locale + slug uniqueness
BlogPostSchema.index({ locale: 1, slug: 1 }, { unique: true });

// Prevent model recompilation in Next.js dev environment
// Check if the model already exists before defining it
const BlogPost: Model<IBlogPost> = mongoose.models.BlogPost || mongoose.model<IBlogPost>('BlogPost', BlogPostSchema);

export default BlogPost;
