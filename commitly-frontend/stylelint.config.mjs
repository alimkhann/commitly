const stylelintConfig = {
  extends: ["stylelint-config-standard", "stylelint-config-tailwindcss"],
  ignoreFiles: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  rules: {
    "color-hex-length": "short",
    "no-descending-specificity": null,
  },
};

export default stylelintConfig;
