// src/tools/document.ts
// Analisis de documentos: 20+ formatos soportados
// PDF, DOCX, XLSX, PPTX, EPUB, RTF, ZIP, imagenes, texto plano, y mas

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const MAX_CONTENT = 50000;

export interface DocumentResult {
  success: boolean;
  content: string;
  fileType: string;
  fileName: string;
  charCount: number;
  pageCount?: number;
  sheetCount?: number;
  slideCount?: number;
  sheetNames?: string[];
  metadata?: { size: number; modified: string; mime: string };
  error?: string;
}

export async function analyzeDocument(filePath: string): Promise<DocumentResult> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  if (!fs.existsSync(filePath)) {
    return { success: false, content: '', fileType: ext, fileName, charCount: 0, error: `Archivo no encontrado: ${fileName}` };
  }

  const stat = fs.statSync(filePath);
  const meta = {
    size: stat.size,
    modified: stat.mtime.toISOString(),
    mime: getMimeType(ext),
  };

  try {
    let result: DocumentResult;
    switch (ext) {
      // Documentos
      case '.pdf': result = await analyzePDF(filePath, fileName); break;
      case '.docx': case '.doc': result = await analyzeDocx(filePath, fileName); break;
      case '.pptx': case '.ppt': result = await analyzePptx(filePath, fileName); break;
      case '.rtf': result = await analyzeRtf(filePath, fileName); break;
      case '.epub': result = await analyzeEpub(filePath, fileName); break;
      case '.odt': result = await analyzeOdt(filePath, fileName); break;
      // Hojas de calculo
      case '.xlsx': case '.xls': case '.xlsm': case '.ods':
        result = analyzeExcel(filePath, fileName, ext); break;
      // Archivos comprimidos
      case '.zip': case '.gz': case '.tar': case '.7z': case '.rar':
        result = analyzeArchive(filePath, fileName, ext); break;
      // Imagenes
      case '.png': case '.jpg': case '.jpeg': case '.gif': case '.bmp':
      case '.svg': case '.webp': case '.ico': case '.tiff': case '.tif':
        result = analyzeImage(filePath, fileName, ext); break;
      // Audio/Video (metadata)
      case '.mp3': case '.wav': case '.ogg': case '.flac': case '.aac':
      case '.mp4': case '.avi': case '.mkv': case '.mov': case '.webm':
        result = analyzeMedia(filePath, fileName, ext); break;
      // Scripts y config
      case '.sh': case '.bash': case '.zsh': case '.fish':
      case '.bat': case '.cmd': case '.ps1': case '.psm1':
      case '.ini': case '.cfg': case '.conf': case '.cnf':
      case '.sql': case '.prisma': case '.graphql':
      case '.gradle': case '.properties':
      case '.tex': case '.bib':
        result = analyzeText(filePath, fileName, ext); break;
      // Texto y codigo
      case '.txt': case '.md': case '.mdx': case '.csv': case '.json': case '.jsonc':
      case '.js': case '.ts': case '.jsx': case '.tsx': case '.mjs': case '.cjs':
      case '.py': case '.pyw': case '.ipynb':
      case '.html': case '.htm': case '.css': case '.scss': case '.less':
      case '.xml': case '.svg': case '.yml': case '.yaml': case '.toml': case '.env':
      case '.log': case '.rst': case '.org':
      case '.c': case '.cpp': case '.h': case '.hpp': case '.cs': case '.java':
      case '.go': case '.rs': case '.rb': case '.php': case '.swift': case '.kt':
      case '.dart': case '.lua': case '.r': case '.scala': case '.clj':
      case '.dockerfile': case '.makefile': case '.cmake':
        result = analyzeText(filePath, fileName, ext); break;
      // Fallback: intentar como texto
      default:
        result = analyzeText(filePath, fileName, ext);
        if (result.charCount > 0) break;
        // Si no es texto, mostrar info basica
        result = {
          success: false,
          content: '',
          fileType: ext || 'desconocido',
          fileName,
          charCount: 0,
          error: `Formato no soportado: ${ext}. Se soportan: PDF, DOCX, XLSX, PPTX, EPUB, RTF, ZIP, PNG/JPG, MP3/MP4, TXT, MD, CSV, JSON, y codigo fuente (JS, TS, PY, HTML, CSS, XML, YAML, y 20+ lenguajes mas).`,
        };
    }
    result.metadata = meta;
    return result;
  } catch (e: unknown) {
    return {
      success: false, content: '', fileType: ext, fileName, charCount: 0,
      metadata: meta,
      error: `Error al analizar: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ========== PDF ==========
async function analyzePDF(filePath: string, fileName: string): Promise<DocumentResult> {
  let pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }>;
  try { pdfParse = require('pdf-parse'); } catch {
    return pdfFallback(filePath, fileName);
  }
  const buffer = fs.readFileSync(filePath);
  delete (buffer as any).__proto__;
  const data = await pdfParse(buffer);
  return {
    success: true,
    content: data.text.slice(0, MAX_CONTENT),
    fileType: 'pdf', fileName,
    charCount: data.text.length,
    pageCount: data.numpages,
  };
}

function pdfFallback(filePath: string, fileName: string): DocumentResult {
  const buf = fs.readFileSync(filePath);
  const text = extractPrintable(buf.toString('binary'));
  if (text.length > 100) {
    return { success: true, content: text.slice(0, MAX_CONTENT), fileType: 'pdf', fileName, charCount: text.length };
  }
  return { success: false, content: '', fileType: 'pdf', fileName, charCount: 0, error: 'pdf-parse no instalado (npm install pdf-parse). Texto extraido limitado: ' + text.length + ' chars.' };
}

// ========== DOCX ==========
async function analyzeDocx(filePath: string, fileName: string): Promise<DocumentResult> {
  let mammoth: { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
  try { mammoth = require('mammoth'); } catch {
    return docxFallback(filePath, fileName);
  }
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return {
    success: true,
    content: result.value.slice(0, MAX_CONTENT),
    fileType: 'docx', fileName,
    charCount: result.value.length,
  };
}

function docxFallback(filePath: string, fileName: string): DocumentResult {
  const text = extractZipXmlText(filePath, 'word/document.xml');
  if (text.length > 50) {
    return { success: true, content: text.slice(0, MAX_CONTENT), fileType: 'docx', fileName, charCount: text.length };
  }
  return { success: false, content: '', fileType: 'docx', fileName, charCount: 0, error: 'mammoth no instalado (npm install mammoth).' };
}

// ========== PPTX ==========
async function analyzePptx(filePath: string, fileName: string): Promise<DocumentResult> {
  try {
    const slides = extractZipSlides(filePath);
    if (slides.length === 0) throw new Error('No se encontraron diapositivas');
    const content = slides.map((s, i) => `[Diapositiva ${i + 1}]\n${s}`).join('\n\n');
    return { success: true, content: content.slice(0, MAX_CONTENT), fileType: 'pptx', fileName, charCount: content.length, slideCount: slides.length };
  } catch (e: unknown) {
    return { success: false, content: '', fileType: 'pptx', fileName, charCount: 0, error: 'Error al leer PPTX: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

// ========== EPUB ==========
async function analyzeEpub(filePath: string, fileName: string): Promise<DocumentResult> {
  try {
    const chapters = extractEpubChapters(filePath);
    if (chapters.length === 0) throw new Error('No se encontraron capitulos');
    const content = chapters.map((c, i) => `[Capitulo ${i + 1}]\n${c}`).join('\n\n');
    return { success: true, content: content.slice(0, MAX_CONTENT), fileType: 'epub', fileName, charCount: content.length };
  } catch (e: unknown) {
    return { success: false, content: '', fileType: 'epub', fileName, charCount: 0, error: 'Error al leer EPUB: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

// ========== RTF ==========
async function analyzeRtf(filePath: string, fileName: string): Promise<DocumentResult> {
  try {
    const raw = fs.readFileSync(filePath, 'latin1');
    const text = extractRtfText(raw);
    if (text.trim().length < 5) throw new Error('Documento RTF vacio');
    return { success: true, content: text.slice(0, MAX_CONTENT), fileType: 'rtf', fileName, charCount: text.length };
  } catch (e: unknown) {
    return { success: false, content: '', fileType: 'rtf', fileName, charCount: 0, error: 'Error al leer RTF: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

// ========== ODT ==========
async function analyzeOdt(filePath: string, fileName: string): Promise<DocumentResult> {
  const text = extractZipXmlText(filePath, 'content.xml');
  if (text.length > 50) {
    return { success: true, content: text.slice(0, MAX_CONTENT), fileType: 'odt', fileName, charCount: text.length };
  }
  return { success: false, content: '', fileType: 'odt', fileName, charCount: 0, error: 'No se pudo extraer texto del ODT.' };
}

// ========== XLSX/Excel ==========
function analyzeExcel(filePath: string, fileName: string, ext: string): DocumentResult {
  let XLSX: { readFile: (p: string) => { SheetNames: string[]; Sheets: Record<string, unknown> }; utils: { sheet_to_csv: (s: unknown) => string } };
  try { XLSX = require('xlsx'); } catch {
    return xlsxFallback(filePath, fileName, ext);
  }
  const workbook = XLSX.readFile(filePath);
  let allText = '';
  const sheetNames: string[] = workbook.SheetNames;
  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    allText += `=== ${name} ===\n${csv}\n\n`;
  }
  return { success: true, content: allText.slice(0, MAX_CONTENT), fileType: ext.slice(1), fileName, sheetCount: sheetNames.length, sheetNames, charCount: allText.length };
}

function xlsxFallback(filePath: string, fileName: string, ext: string): DocumentResult {
  try {
    const strings = extractZipXmlText(filePath, 'xl/sharedStrings.xml');
    if (strings.length > 20) {
      return { success: true, content: strings.slice(0, MAX_CONTENT), fileType: ext.slice(1), fileName, charCount: strings.length };
    }
  } catch { /* fallback failed */ }
  return { success: false, content: '', fileType: ext.slice(1), fileName, charCount: 0, error: 'xlsx no instalado (npm install xlsx).' };
}

// ========== ZIP/Archive ==========
function analyzeArchive(filePath: string, fileName: string, ext: string): DocumentResult {
  try {
    const listing = listZipContents(filePath);
    return { success: true, content: listing.slice(0, MAX_CONTENT), fileType: ext.slice(1), fileName, charCount: listing.length };
  } catch (e: unknown) {
    return { success: false, content: '', fileType: ext.slice(1), fileName, charCount: 0, error: 'No se pudo listar el archivo: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

// ========== Imagenes ==========
function analyzeImage(filePath: string, fileName: string, ext: string): DocumentResult {
  try {
    const buf = fs.readFileSync(filePath);
    let dims = '';
    if (ext === '.png' && buf.length > 24) {
      const w = buf.readUInt32BE(16); const h = buf.readUInt32BE(20);
      dims = `${w}x${h}px`;
    } else if ((ext === '.jpg' || ext === '.jpeg') && buf.length > 4) {
      let off = 2;
      while (off < buf.length - 9) {
        if (buf[off] === 0xFF && (buf[off + 1] === 0xC0 || buf[off + 1] === 0xC2)) {
          const h = buf.readUInt16BE(off + 5); const w = buf.readUInt16BE(off + 7);
          dims = `${w}x${h}px`; break;
        }
        off += buf.readUInt16BE(off + 2) + 2;
      }
    } else if (ext === '.gif' && buf.length > 10) {
      dims = `${buf.readUInt16LE(6)}x${buf.readUInt16LE(8)}px`;
    }
    const sizeKB = Math.round(buf.length / 1024);
    return {
      success: true,
      content: `[Imagen ${ext.slice(1).toUpperCase()}] ${dims || 'dimensiones desconocidas'} — ${sizeKB}KB — ${fileName}`,
      fileType: 'imagen', fileName, charCount: 0,
    };
  } catch (e: unknown) {
    return { success: false, content: '', fileType: 'imagen', fileName, charCount: 0, error: 'Error al leer imagen: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

// ========== Audio/Video ==========
function analyzeMedia(filePath: string, fileName: string, ext: string): DocumentResult {
  try {
    const stat = fs.statSync(filePath);
    const sizeMB = Math.round(stat.size / 1024 / 1024 * 100) / 100;
    return {
      success: true,
      content: `[${ext.slice(1).toUpperCase()}] ${fileName} — ${sizeMB}MB — Modificado: ${stat.mtime.toISOString()}`,
      fileType: ext.slice(1), fileName, charCount: 0,
    };
  } catch (e: unknown) {
    return { success: false, content: '', fileType: ext.slice(1), fileName, charCount: 0, error: 'Error: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

// ========== Texto plano ==========
function analyzeText(filePath: string, fileName: string, ext: string): DocumentResult {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content: content.slice(0, MAX_CONTENT), fileType: ext.slice(1), fileName, charCount: content.length };
  } catch {
    try {
      const content = fs.readFileSync(filePath, 'latin1');
      return { success: true, content: content.slice(0, MAX_CONTENT), fileType: ext.slice(1), fileName, charCount: content.length };
    } catch (e: unknown) {
      return { success: false, content: '', fileType: ext.slice(1), fileName, charCount: 0, error: 'No se pudo leer el archivo.' };
    }
  }
}

// ========== HELPERS ==========

function getMimeType(ext: string): string {
  const mimes: Record<string, string> = {
    '.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.epub':'application/epub+zip','.rtf':'application/rtf','.odt':'application/vnd.oasis.opendocument.text',
    '.zip':'application/zip','.gz':'application/gzip','.tar':'application/x-tar',
    '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp',
    '.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4',
    '.txt':'text/plain','.md':'text/markdown','.json':'application/json','.csv':'text/csv',
    '.html':'text/html','.css':'text/css','.js':'text/javascript','.ts':'text/typescript',
    '.xml':'application/xml','.yaml':'text/yaml','.yml':'text/yaml',
  };
  return mimes[ext] || 'application/octet-stream';
}

function extractPrintable(content: string): string {
  return content.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t\u00C0-\u024F\u1E00-\u1EFF]/g, ' ')
    .replace(/\s{3,}/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ZIP-based format helpers (PPTX, DOCX, EPUB, ODT, XLSX are all ZIP files)
function extractZipXmlText(zipPath: string, xmlPath: string): string {
  try {
    const raw = fs.readFileSync(zipPath);
    const { centralDirOffset, entries } = readZipDirectory(raw);
    for (const entry of entries) {
      if (entry.name === xmlPath || entry.name.endsWith('/' + xmlPath)) {
        const compressed = raw.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize);
        let decompressed: Buffer;
        if (entry.method === 0) decompressed = compressed;
        else if (entry.method === 8) decompressed = zlib.inflateRawSync(compressed);
        else continue;
        const xml = decompressed.toString('utf8');
        return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  } catch { /* extraction failed */ }
  return '';
}

function readZipDirectory(buf: Buffer): { centralDirOffset: number; entries: Array<{ name: string; method: number; compressedSize: number; dataOffset: number }> } {
  // Find end of central directory
  let eocdOffset = buf.length - 22;
  while (eocdOffset > 0 && buf.readUInt32LE(eocdOffset) !== 0x06054b50) eocdOffset--;
  if (eocdOffset <= 0) return { centralDirOffset: 0, entries: [] };

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);
  let pos = cdOffset;
  const entries: Array<{ name: string; method: number; compressedSize: number; dataOffset: number }> = [];

  while (pos < cdOffset + cdSize) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const name = buf.slice(pos + 46, pos + 46 + nameLen).toString('utf8');

    // Read local header to get actual data offset
    const localPos = localHeaderOffset;
    if (buf.readUInt32LE(localPos) === 0x04034b50) {
      const localNameLen = buf.readUInt16LE(localPos + 26);
      const localExtraLen = buf.readUInt16LE(localPos + 28);
      const dataOffset = localPos + 30 + localNameLen + localExtraLen;
      entries.push({ name, method, compressedSize, dataOffset });
    }

    pos += 46 + nameLen + extraLen + commentLen;
  }

  return { centralDirOffset: cdOffset, entries };
}

function extractZipSlides(zipPath: string): string[] {
  try {
    const raw = fs.readFileSync(zipPath);
    const { entries } = readZipDirectory(raw);
    const slideFiles = entries
      .filter(e => /ppt\/slides\/slide\d+\.xml$/.test(e.name))
      .sort((a, b) => {
        const an = parseInt((a.name.match(/slide(\d+)/) || ['', '0'])[1]);
        const bn = parseInt((b.name.match(/slide(\d+)/) || ['', '0'])[1]);
        return an - bn;
      });

    return slideFiles.map(entry => {
      const compressed = raw.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize);
      let decompressed: Buffer;
      if (entry.method === 0) decompressed = compressed;
      else if (entry.method === 8) decompressed = zlib.inflateRawSync(compressed);
      else return '';
      return decompressed.toString('utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }).filter(t => t.length > 0);
  } catch { /* extraction failed */ }
  return [];
}

function extractEpubChapters(epubPath: string): string[] {
  try {
    const raw = fs.readFileSync(epubPath);
    const { entries } = readZipDirectory(raw);
    const htmlFiles = entries.filter(e => e.name.endsWith('.html') || e.name.endsWith('.xhtml') || e.name.endsWith('.htm'));
    return htmlFiles.map(entry => {
      const compressed = raw.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize);
      let decompressed: Buffer;
      if (entry.method === 0) decompressed = compressed;
      else if (entry.method === 8) decompressed = zlib.inflateRawSync(compressed);
      else return '';
      return decompressed.toString('utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }).filter(t => t.length > 20);
  } catch { /* extraction failed */ }
  return [];
}

function listZipContents(zipPath: string): string {
  try {
    const raw = fs.readFileSync(zipPath);
    const { entries } = readZipDirectory(raw);
    if (entries.length === 0) return '(archivo ZIP vacio o corrupto)';
    const lines = entries.map(e => {
      const sizeKB = Math.round(e.compressedSize / 1024);
      const isDir = e.name.endsWith('/');
      return `${isDir ? '📁' : '📄'} ${e.name} ${isDir ? '' : `(${sizeKB}KB)`}`;
    });
    return `[ZIP] ${entries.length} archivos:\n${lines.join('\n')}`;
  } catch (e: unknown) {
    return 'Error al listar ZIP: ' + (e instanceof Error ? e.message : String(e));
  }
}

function extractRtfText(raw: string): string {
  let text = raw;
  // Remove RTF control words and groups
  text = text.replace(/\\\*\\[a-z]+(?:-?\d+)?[ ]?/gi, '');
  text = text.replace(/\\[a-z]+(?:-?\d+)?[ ]?/gi, ' ');
  text = text.replace(/[{}]/g, ' ');
  // Decode escaped chars
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/\\par\b/gi, '\n');
  text = text.replace(/\\tab\b/gi, '\t');
  text = text.replace(/\\line\b/gi, '\n');
  text = text.replace(/\\~/g, '\u00A0');
  text = text.replace(/\\_/g, '\u2011');
  text = text.replace(/\\-/g, '');
  return text.replace(/\s+/g, ' ').trim();
}
