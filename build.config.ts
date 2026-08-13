import { defineBuildConfig } from "obuild/config";

/**
 * Library build: the importable API plus the self-registering custom element.
 * Four entries, one bundle each, into `dist/` — which holds the library alone.
 *
 * JSX and the `@/*` alias come from `tsconfig.json`, which rolldown reads:
 * `jsxImportSource: "preact"`, so no react runtime can reach the output.
 * Everything in `dependencies` stays external.
 */
export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: [
        "./src/index.ts",
        "./src/element.tsx",
        "./src/components/index.ts",
        "./src/agent/index.ts",
      ],
      rolldown: { platform: "browser" },
    },
  ],
});
