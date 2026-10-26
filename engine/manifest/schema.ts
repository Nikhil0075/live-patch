import { z } from 'zod';

export const manifestSchema = z.object({
  name: z.string().min(1),
  entry: z.string().regex(/^src\/[\w./-]+\.ts$/),
  mutationDir: z.string().regex(/^[\w./-]+\/$/),
  apiDocs: z.string().regex(/^[\w./-]+\.md$/),
  examples: z.array(z.string().regex(/^[\w./-]+\/$/)),
  forbidden: z.array(z.string()),
  testCommand: z.string().min(1),
  reload: z.object({ type: z.literal('websocket'), url: z.string().regex(/^ws:\/\/(?:127\.0\.0\.1|localhost):\d+\/\w+$/, 'Must be a local WebSocket URL with an explicit port and path') }),
  maxFileLines: z.number().int().positive().max(120)
});
export type GameManifest = z.infer<typeof manifestSchema>;
