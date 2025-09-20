module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
    browser: false,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    project: ["./tsconfig.base.json"],
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  settings: {
    "import/resolver": {
      typescript: {
        project: ["tsconfig.base.json"],
      },
    },
  },
  rules: {
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "import/order": [
      "warn",
      {
        groups: [["builtin", "external"], ["internal", "parent", "sibling", "index"]],
        "newlines-between": "always",
      },
    ],
  },
  ignorePatterns: [
    "**/dist/**",
    "**/node_modules/**",
    "**/*.config.js",
    "**/*.config.cjs",
  ],
};


