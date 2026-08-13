import { defineBuildConfig } from "obuild/config";

/**
 * Library build: the importable API. Six entries, one bundle each, into `dist/`
 * — which holds the library alone.
 *
 * JSX and the `@/*` alias come from `tsconfig.json`, which rolldown reads:
 * `jsxImportSource: "preact"`, so no react runtime can reach the output — the
 * react wrapper calls `createElement` and writes no JSX. `react` and `vue` are
 * optional peers, so both stay external and neither has to be installed.
 */
export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: [
        "./src/index.ts",
        "./src/components/index.ts",
        "./src/pi/index.ts",
        "./src/preact/index.tsx",
        "./src/react/index.ts",
        "./src/vue/index.ts",
      ],
      rolldown: { platform: "browser" },
    },
  ],
});
