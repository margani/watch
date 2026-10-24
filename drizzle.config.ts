import { defineConfig } from 'drizzle-kit';

// Only used to generate SQL migrations; wrangler applies them (`wrangler d1 migrations apply`).
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './migrations',
	dialect: 'sqlite',
	strict: true
});
