import { z } from 'zod';

export const supportedLanguages = ['en', 'de', 'fr', 'es', 'it'];

export const promptSchema = z.object({
  prompt: z.string().trim().min(1, 'Tell us what you want to explore.'),
  targetLanguage: z.enum(supportedLanguages),
});