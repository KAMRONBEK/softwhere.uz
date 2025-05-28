const https = require('https');
const http = require('http');

async function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;

    const req = protocol.request(url, options, res => {
      let body = '';

      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);

          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function generateNewPost() {
  console.log('Starting weekly blog post generation...');

  // Debug environment variables (don't log sensitive data)
  console.log('Environment check:');
  console.log('- WEBSITE_URL:', process.env.WEBSITE_URL || 'NOT SET');
  console.log('- API_SECRET:', process.env.API_SECRET ? 'SET' : 'NOT SET');
  console.log('- NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

  try {
    // Check if WEBSITE_URL is set
    const baseUrl = process.env.WEBSITE_URL;

    if (!baseUrl) {
      console.error('ERROR: WEBSITE_URL environment variable is not set!');
      console.error(
        'Please set WEBSITE_URL in your GitHub Secrets to your deployed website URL'
      );
      console.error('Example: https://softwhere.uz');
      process.exit(1);
    }

    // Define the payload for the post generation.
    const postData = {
      category: 'AUTOMATED_POSTS',
      locales: ['en', 'ru', 'uz'],
      customTopic: 'Weekly Tech Update',
    };

    const apiUrl = `${baseUrl}/api/blog/generate`;

    console.log('API URL:', apiUrl);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.API_SECRET}`,
      },
    };

    console.log('Calling blog generation API with data:', postData);

    const response = await makeRequest(apiUrl, options, postData);

    if (response.status === 200 || response.status === 201) {
      console.log('Successfully generated new blog post:', response.data);
    } else {
      console.error('Failed to generate blog post. Status:', response.status);
      console.error('Response:', response.data);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      'An error occurred during blog post generation:',
      error.message
    );
    process.exit(1);
  }
}

// Ensure the script is executable and handles promise rejection
if (require.main === module) {
  generateNewPost().catch(error => {
    console.error('Unhandled error in generateNewPost script:', error.message);
    process.exit(1);
  });
}
