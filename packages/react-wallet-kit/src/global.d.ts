// For CSS modules
declare module "*.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// For SVG files
declare module "*.svg" {
  const content: string;
  export default content;
}
