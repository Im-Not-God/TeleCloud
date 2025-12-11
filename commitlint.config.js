export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    //   TODO Add Scope Enum Here
    // 'scope-enum': [2, 'always', ['yourscope', 'yourscope']],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "chore",
        "style",
        "refactor",
        "ci",
        "test",
        "perf",
        "revert",
        "vercel",
      ],
    ],
    // type 不允为空
    "type-empty": [2, "never"],

    // subject 不为空
    "subject-empty": [2, "never"],

    // subject 不以 . 结尾
    "subject-full-stop": [2, "never", "."],

    // 允许中文（默认不限制，只是保险）
    "subject-case": [0],
  },
};
