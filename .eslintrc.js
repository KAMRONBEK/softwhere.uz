module.exports = {
  root: true,
  extends: [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "boundaries"],
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  settings: {
    react: { version: "detect" },
    "boundaries/elements": [
      { type: "core", pattern: "src/{core,utils}/*" },
      { type: "shared", pattern: "src/shared/*" },
      { type: "modules", pattern: "src/modules/*" },
      { type: "app", pattern: "src/app/*" },
    ],
  },
  rules: {
    "prettier/prettier": "error",

    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-empty-object-type": "off",
    "no-console": "warn",
    "no-debugger": "error",
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-template": "error",

    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    "boundaries/element-types": [
      "warn",
      {
        default: "disallow",
        rules: [
          { from: "core", allow: [] },
          { from: "shared", allow: ["core", "shared"] },
          { from: "modules", allow: ["core", "shared", "modules"] },
          { from: "app", allow: ["core", "shared", "modules", "app"] },
        ],
      },
    ],
  },
};
