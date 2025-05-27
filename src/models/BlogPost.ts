import mongoose, { Schema, Document, Model } from 'mongoose';

// Define the structure of a BlogPost document
export interface IBlogPost extends Document {
    title: string;
    slug: string;
    content: string;
    status: 'draft' | 'published';
    locale: 'en' | 'ru' | 'uz';
    generationGroupId?: string;
    createdAt: Date;
    updatedAt: Date;
    // Add other fields as needed, e.g.:
    // author?: Schema.Types.ObjectId | IUser; // Example if referencing a User model
    // tags?: string[];
    // featuredImage?: string;
    // metaDescription?: string;
}

const BlogPostSchema = new Schema<IBlogPost>({
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
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Add compound index for locale + slug uniqueness
BlogPostSchema.index({ locale: 1, slug: 1 }, { unique: true });

// Prevent model recompilation in Next.js dev environment
// Check if the model already exists before defining it
const BlogPost: Model<IBlogPost> = mongoose.models.BlogPost || mongoose.model<IBlogPost>('BlogPost', BlogPostSchema);

export default BlogPost; 