import "server-only";

import { createLogger } from "@/src/lib/logger";

const logger = createLogger("resume-parser-server");

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function extractTxt(file: File) {
  const text = await file.text();
  return normalizeText(text);
}

async function extractDocx(file: File) {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return normalizeText(result.value);
}

async function extractPdf(file: File) {
  type PdfJsTextItem = { str?: string };
  type PdfJsModule = {
    getDocument: (options: { data: Uint8Array; disableWorker?: boolean }) => {
      promise: Promise<{
        numPages: number;
        getPage: (pageNumber: number) => Promise<{
          getTextContent: () => Promise<{ items: PdfJsTextItem[] }>;
        }>;
      }>;
    };
  };

  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsModule;
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
  });

  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => {
        if ("str" in item) {
          return item.str;
        }

        return "";
      })
      .join(" ");

    pages.push(pageText);
  }

  return normalizeText(pages.join("\n"));
}

/**
 * Extracts plain resume text from uploaded PDF, DOCX, or TXT files on the server.
 */
export async function extractResumeTextServer(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();

  logger.info("Server-side resume text extraction started.", {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  if (lowerName.endsWith(".txt") || file.type === "text/plain") {
    return extractTxt(file);
  }

  if (
    lowerName.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocx(file);
  }

  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdf(file);
  }

  throw new Error("Unsupported resume format. Please use PDF, DOCX, or TXT.");
}
