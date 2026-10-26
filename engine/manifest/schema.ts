import { z } from 'zod';

const argumentSchema = z.object({
  type: z.enum(['number', 'string', 'boolean']),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  maxLength: z.number().int().positive().optional(),
  values: z.array(z.string()).optional(),
  optional: z.boolean().optional()
});

export const manifestSchema = z.object({
  name: z.string().min(1),
  hint: z.string().max(200),
  entry: z.string().regex(/^src\/[\w./-]+\.ts$/),
  mutationDir: z.string().regex(/^[\w./-]+\/$/),
  apiDocs: z.string().regex(/^[\w./-]+\.md$/),
  examples: z.array(z.string().regex(/^[\w./-]+\/$/)),
  forbidden: z.array(z.string()),
  testCommand: z.string().min(1),
  actions: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), z.array(argumentSchema).max(8)),
  hooks: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), z.string().regex(/^on[A-Z][a-zA-Z0-9]*$/)),
  reload: z.object({ type: z.literal('websocket'), url: z.string().regex(/^ws:\/\/(?:127\.0\.0\.1|localhost):\d+\/?$/, 'Must be a local WebSocket URL with an explicit port'), event: z.string().regex(/^[\w:-]+$/) }),
  maxFileLines: z.number().int().positive().max(120)
});
export type GameManifest = z.infer<typeof manifestSchema>;
