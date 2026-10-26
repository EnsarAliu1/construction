import { defineConfig } from "drizzle-kit";

// Generation/checking is offline. Only the guarded db:migrate runner connects.
export default defineConfig({
  dialect: "mysql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
