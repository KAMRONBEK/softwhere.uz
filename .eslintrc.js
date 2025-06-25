/*
 * Root ESLint configuration (ESLint v8 – used by `next lint`)
 */
module.exports = {
  root: true,
  extends: [
    "next/core-web-vitals",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:prettier/recommended",
  ],
  plugins: ["boundaries"],
  settings: {
    // boundaries plugin settings – must mirror eslint.config.mjs
    "boundaries/elements": [
      { type: "core", pattern: "src/{core,utils}/*" },
      { type: "shared", pattern: "src/shared/*" },
      { type: "modules", pattern: "src/modules/*" },
      { type: "app", pattern: "src/app/*" },
    ],
  },
  rules: {
    'prettier/prettier': ['error', { endOfLine: 'auto' }],
    // Architectural boundaries
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