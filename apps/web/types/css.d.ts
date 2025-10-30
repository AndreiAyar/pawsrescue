// CSS Module declarations for named imports
declare module "*.module.css" {
  const content: Record<string, string>;
  export default content;
}

// CSS side-effect imports (no export needed)
declare module "*.css" {}

// MapTiler SDK CSS specific declaration
declare module "@maptiler/sdk/dist/maptiler-sdk.css" {}