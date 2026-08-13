// `markdown()` in vite.config.ts renders the file to HTML at build time.
declare module "*.md" {
  const html: string;
  export default html;
}
