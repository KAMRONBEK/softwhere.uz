import { logger } from './logger';

interface EnvConfig {
  MONGODB_URI: string;
  GOOGLE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  API_SECRET?: string;
  NODE_ENV: string;
}

const requiredEnvVars = ['MONGODB_URI'] as const;
const optionalEnvVars = ['GOOGLE_API_KEY', 'OPENAI_API_KEY', 'API_SECRET'] as const;

export function validateEnvironment(): EnvConfig {
  const env: Partial<EnvConfig> = {
    MONGODB_URI: process.env.MONGODB_URI,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    API_SECRET: process.env.API_SECRET,
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
    logger.warn(
      `Missing optional environment variables: ${missingOptional.join(', ')}. Some features may not work.`,
      undefined,
      'ENV'
    );
  }

  logger.info('Environment validation completed', undefined, 'ENV');
  
  return env as EnvConfig;
}

export const env = validateEnvironment(); 