import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Generation/build do not connect. Runtime and setup require a real URL.
  datasource: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://localhost/ai_service_unconfigured",
  },
});
