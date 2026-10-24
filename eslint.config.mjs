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
  // next/link を直接使わない（先読みを止めた共通部品 components/SiteLink.tsx を使う。D-26）。
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message: "components/SiteLink.tsx を使う（先読みを止めてある。20260808_decisions.md D-26）。",
            },
          ],
        },
      ],
    },
  },
  { files: ["components/SiteLink.tsx"], rules: { "no-restricted-imports": "off" } },
]);

export default eslintConfig;
