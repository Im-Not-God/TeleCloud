// eslint.config.js
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import eslintRecommended from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  // 基础 JS 推荐规则
  eslintRecommended.configs.recommended,

  // ⭐ Node 环境支持：让 module / require / __dirname 不报错
  {
    files: [
      "commitlint.config.*",
      "vite.config.*",
      "**/*.config.js",
      "**/*.config.ts",
      "**/*.config.cjs",
      "**/*.config.mjs",
      "scripts/**/*.{js,ts}",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "warn",
    },
  },

  // Cloudflare Worker 环境
  {
    files: ["worker.js", "worker.ts"],
    languageOptions: {
      globals: {
        ...globals.serviceworker, // Cloudflare Worker 基本 = Service Worker
      },
    },
    rules: {
      "no-unused-vars": "warn",
    },
  },

  // TS/TSX 项目规则（主要应用到 src/）
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // custom rules
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-undef": "warn",
    },
  },

  prettier,
];
