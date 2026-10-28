import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", ".next-wp09/**", ".next-wp10/**", ".next-wp11/**", ".next-wp13/**", ".next-wp14/**", ".next-wp16/**", ".next-wp15/**", "playwright-report/**", "test-results/**", "out/**", "next-env.d.ts", "artifacts/**"]),
]);
