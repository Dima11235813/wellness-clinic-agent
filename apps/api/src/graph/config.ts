import { z } from "zod";

const Config = z.object({
  OPENAI_API_KEY: z.string().min(1),
  MODEL: z.string().default("gpt-4o-mini"),
  TIMEOUT_MS: z.coerce.number().default(60_000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LANGSMITH_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof Config>;

export function loadConfig(): AppConfig {
  return Config.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    MODEL: process.env.MODEL,
    TIMEOUT_MS: process.env.TIMEOUT_MS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY,
  });
}
