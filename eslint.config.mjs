import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".private/", ".next-demo/", ".next/**", ".next-passkeys/**", ".next-wp09/**", ".next-wp10/**", ".next-wp11/**", ".next-wp13/**", ".next-wp14/**", ".next-wp16/**", ".next-sq/**", ".next-wp15/**", "playwright-report/**", "test-results/**", "out/**", "next-env.d.ts", "artifacts/**"]),
]);
