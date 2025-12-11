// eslint.config.js
// eslint.config.js
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import eslintRecommended from "@eslint/js";
import prettier from "eslint-config-prettier";

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
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
      },
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
    },
  },

  prettier,
];
