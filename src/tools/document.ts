// src/tools/document.ts
// Analisis de documentos: PDF, DOCX, XLSX, TXT, MD, CSV, JSON

import * as fs from 'fs';
import * as path from 'path';

const MAX_CONTENT = 50000;

export interface DocumentResult {
  success: boolean;
  content: string;
  fileType: string;
  fileName: string;
  charCount: number;
  pageCount?: number;
  sheetCount?: number;
  sheetNames?: string[];
  error?: string;
}

export async function analyzeDocument(filePath: string): Promise<DocumentResult> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  if (!fs.existsSync(filePath)) {
    return { success: false, content: '', fileType: ext, fileName, charCount: 0, error: `Archivo no encontrado: ${fileName}` };
  }

  try {
    switch (ext) {
      case '.pdf': return await analyzePDF(filePath, fileName);
      case '.docx': return await analyzeDocx(filePath, fileName);
      case '.xlsx': case '.xls': return analyzeExcel(filePath, fileName, ext);
      case '.txt': case '.md': case '.csv': case '.json':
      case '.js': case '.ts': case '.jsx': case '.tsx':
      case '.py': case '.html': case '.css': case '.xml':
      case '.yml': case '.yaml': case '.toml': case '.env':
        return analyzeText(filePath, fileName, ext);
      default:
        return { success: false, content: '', fileType: ext, fileName, charCount: 0, error: `Formato no soportado: ${ext}. Soportados: PDF, DOCX, XLSX, XLS, TXT, MD, CSV, JSON, JS, TS, PY, HTML, CSS` };
    }
  } catch (e: unknown) {
    return { success: false, content: '', fileType: ext, fileName, charCount: 0, error: `Error al analizar: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function analyzePDF(filePath: string, fileName: string): Promise<DocumentResult> {
  let pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }>;
  try {
    pdfParse = require('pdf-parse');
  } catch {
    return { success: false, content: '', fileType: 'pdf', fileName, charCount: 0, error: 'pdf-parse no instalado. Instala con: npm install pdf-parse' };
  }
  const buffer = fs.readFileSync(filePath);
  // Disable test file check
  delete (buffer as any).__proto__;
  const data = await pdfParse(buffer);
  return {
    success: true,
    content: data.text.slice(0, MAX_CONTENT),
    fileType: 'pdf',
    fileName,
    charCount: data.text.length,
    pageCount: data.numpages,
  };
}

async function analyzeDocx(filePath: string, fileName: string): Promise<DocumentResult> {
  let mammoth: { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
  try {
    mammoth = require('mammoth');
  } catch {
    return { success: false, content: '', fileType: 'docx', fileName, charCount: 0, error: 'mammoth no instalado. Instala con: npm install mammoth' };
  }
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return {
    success: true,
    content: result.value.slice(0, MAX_CONTENT),
    fileType: 'docx',
    fileName,
    charCount: result.value.length,
  };
}

function analyzeExcel(filePath: string, fileName: string, ext: string): DocumentResult {
  let XLSX: { readFile: (p: string) => { SheetNames: string[]; Sheets: Record<string, unknown> }; utils: { sheet_to_csv: (s: unknown) => string } };
  try {
    XLSX = require('xlsx');
  } catch {
    return { success: false, content: '', fileType: ext.slice(1), fileName, charCount: 0, error: 'xlsx no instalado. Instala con: npm install xlsx' };
  }
  const workbook = XLSX.readFile(filePath);
  let allText = '';
  const sheetNames: string[] = workbook.SheetNames;

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    allText += `=== ${name} ===\n${csv}\n\n`;
  }

  return {
    success: true,
    content: allText.slice(0, MAX_CONTENT),
    fileType: ext.slice(1),
    fileName,
    sheetCount: sheetNames.length,
    sheetNames,
    charCount: allText.length,
  };
}

function analyzeText(filePath: string, fileName: string, ext: string): DocumentResult {
  const content = fs.readFileSync(filePath, 'utf8');
  return {
    success: true,
    content: content.slice(0, MAX_CONTENT),
    fileType: ext.slice(1),
    fileName,
    charCount: content.length,
  };
}
