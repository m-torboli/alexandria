// La build "legacy" di PDF.js ha la stessa interfaccia di quella principale.
declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export * from "pdfjs-dist";
}
