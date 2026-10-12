import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 は flat config をそのまま提供する（FlatCompat 経由だと
// 「Converting circular structure to JSON」で設定読み込みに失敗する＝launch-backlog C-11）。
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "scripts/**",
    "data/**",
  ]),
]);

export default eslintConfig;
