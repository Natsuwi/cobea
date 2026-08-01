import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3847),
  STORAGE_MODE: z.enum(['standard', 'google']).default('standard'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(16),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z
    .string()
    .default('http://localhost:3847/api/auth/google/callback'),
  PUBLIC_API_URL: z.string().default(''),
});

export const env = envSchema.parse(process.env);
