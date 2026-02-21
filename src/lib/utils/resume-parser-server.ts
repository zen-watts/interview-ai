import "server-only";

import { createRequire } from "node:module";

import { createLogger } from "@/src/lib/logger";

const logger = createLogger("resume-parser-server");
const require = createRequire(import.meta.url);

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
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (input: Buffer | Uint8Array) => Promise<{ text: string }>;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdfParse(buffer);
  return normalizeText(result.text || "");
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
