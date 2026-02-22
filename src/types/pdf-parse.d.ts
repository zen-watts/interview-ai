declare module "pdf-parse" {
  interface PDFParseResult {
    text: string;
  }

  function pdfParse(dataBuffer: Buffer | Uint8Array): Promise<PDFParseResult>;

  export = pdfParse;
}
