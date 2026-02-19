import { logger } from './logger';

interface EnvConfig {
  MONGODB_URI: string;
  DEEPSEEK_API_KEY?: string;
  API_SECRET?: string;
  UNSPLASH_ACCESS_KEY?: string;
  NODE_ENV: string;
}

const requiredEnvVars = ['MONGODB_URI'] as const;
const optionalEnvVars = ['DEEPSEEK_API_KEY', 'API_SECRET', 'UNSPLASH_ACCESS_KEY'] as const;

export function validateEnvironment(): EnvConfig {
  const env: Partial<EnvConfig> = {
    MONGODB_URI: process.env.MONGODB_URI,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    API_SECRET: process.env.API_SECRET,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  // Check required environment variables
  const missingRequired = requiredEnvVars.filter(key => !env[key]);

  if (missingRequired.length > 0) {
    const message = `Missing required environment variables: ${missingRequired.join(', ')}`;

    logger.error(message, undefined, 'ENV');
    throw new Error(message);
  }

  // Warn about missing optional environment variables
  const missingOptional = optionalEnvVars.filter(key => !env[key]);

  if (missingOptional.length > 0) {
    logger.warn(`Missing optional environment variables: ${missingOptional.join(', ')}. Some features may not work.`, undefined, 'ENV');
  }

  logger.info('Environment validation completed', undefined, 'ENV');

  return env as EnvConfig;
}

export const env = validateEnvironment();
