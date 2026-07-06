// `pdf-parse` v1 ships no bundled types and none are published under
// `@types/pdf-parse` for this major. Minimal ambient shape for test usage only.
declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(data: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdfParse;
}
