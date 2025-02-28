module.exports = {
  plugins: [
    require("postcss-nested"),
    require("cssnano")({
      preset: "default",
    }),
  ],
};
