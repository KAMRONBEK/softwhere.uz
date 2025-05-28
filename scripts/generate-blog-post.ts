import { api } from '../src/utils/api';
import { logger } from '../src/utils/logger';

async function generateNewPost() {
  logger.info('Starting weekly blog post generation...');

  // Ensure API_SECRET is loaded if your API client or the endpoint requires it.
  // The actual API client setup in api.ts should handle headers if API_SECRET is globally configured.
  // If not, you might need to pass it or ensure 'env.API_SECRET' is accessible and used by the client.

  try {
    // Define the payload for the post generation.
    const postData = {
      category: 'AUTOMATED_POSTS', // Or any relevant category
      locales: ['en', 'ru', 'uz'], // Specify locales to generate for
      customTopic: 'Weekly Tech Update', // Optional: you can remove if not needed or make it dynamic
    };

    logger.info('Calling api.blog.generatePosts with data:', postData);
    const response = await api.blog.generatePosts(postData);

    if (response.success) {
      logger.info('Successfully generated new blog post:', response.data);
      // console.log('Successfully generated new blog post:', response.data);
    } else {
      logger.error('Failed to generate blog post:', response.error);
      // console.error('Failed to generate blog post:', response.error);
      process.exit(1); // Exit with error code
    }
  } catch (error) {
    logger.error('An error occurred during blog post generation:', error);
    // console.error('An error occurred during blog post generation:', error);
    process.exit(1); // Exit with error code
  }
}

// Ensure the script is executable and handles promise rejection
if (require.main === module) {
  generateNewPost().catch(error => {
    logger.error('Unhandled error in generateNewPost script:', error);
    // console.error('Unhandled error in generateNewPost script:', error);
    process.exit(1);
  });
}
