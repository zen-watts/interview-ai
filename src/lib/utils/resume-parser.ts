import { createLogger } from "@/src/lib/logger";

const logger = createLogger("resume-parser");

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
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const buffer = await file.arrayBuffer();
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
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
 * Extracts plain resume text from browser-uploaded PDF, DOCX, or TXT files.
 */
export async function extractResumeText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();

  logger.info("Resume text extraction started.", {
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
