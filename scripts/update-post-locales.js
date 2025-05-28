const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Import BlogPost model (using require since this is a script)
const BlogPost = require('../src/models/BlogPost').default;

async function updatePostsWithoutLocale() {
  try {
    // Find all posts that don't have a locale field or have a null/undefined locale
    const postsWithoutLocale = await BlogPost.find({
      $or: [{ locale: { $exists: false } }, { locale: null }],
    });

    console.log(`Found ${postsWithoutLocale.length} posts without locale`);

    if (postsWithoutLocale.length === 0) {
      console.log('No posts need updating.');
      return process.exit(0);
    }

    // Update each post - we'll set locale based on title language detection
    // This is a simple approach - for production you might want more sophisticated detection
    for (const post of postsWithoutLocale) {
      // Default to 'en' if we can't determine the language
      let detectedLocale = 'en';

      // Very simple language detection based on common characters
      // This is a simplistic approach and not fully reliable
      const title = post.title.toLowerCase();

      // Check for Cyrillic characters (Russian)
      if (/[а-яё]/.test(title)) {
        detectedLocale = 'ru';
      }
      // Check for Uzbek-specific characters/words
      else if (/[ōʻʼ]/.test(title) || title.includes('oʻzbek')) {
        detectedLocale = 'uz';
      }

      console.log(
        `Updating post "${post.title}" with locale: ${detectedLocale}`
      );

      // Update the post with the detected locale
      await BlogPost.updateOne(
        { _id: post._id },
        {
          $set: {
            locale: detectedLocale,
            // Also set status to published if you want them to appear on the site
            status: 'published',
          },
        }
      );
    }

    console.log('All posts updated successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error updating posts:', error);
    process.exit(1);
  }
}

// Run the function
updatePostsWithoutLocale();
