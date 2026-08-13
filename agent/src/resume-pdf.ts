import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { NOTO_SANS_BOLD_BASE64, NOTO_SANS_REGULAR_BASE64 } from "./resume-fonts.js";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK = rgb(0.12, 0.16, 0.14);
const FAINT = rgb(0.4, 0.44, 0.42);

interface ResumeBlock {
  kind: "h1" | "h2" | "h3" | "meta" | "bullet" | "paragraph";
  text: string;
}

function parseResumeMarkdown(markdown: string): ResumeBlock[] {
  const blocks: ResumeBlock[] = [];
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("### ")) blocks.push({ kind: "h3", text: line.slice(4) });
    else if (line.startsWith("## ")) blocks.push({ kind: "h2", text: line.slice(3) });
    else if (line.startsWith("# ")) blocks.push({ kind: "h1", text: line.slice(2) });
    else if (line.startsWith("- ") || line.startsWith("* ")) blocks.push({ kind: "bullet", text: line.slice(2) });
    else if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
      blocks.push({ kind: "meta", text: line.slice(1, -1) });
    } else blocks.push({ kind: "paragraph", text: line.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") });
  }
  return blocks;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

class PdfWriter {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private regular!: PDFFont;
  private bold!: PDFFont;
  private y = PAGE_HEIGHT - MARGIN;

  async init(): Promise<void> {
    this.doc = await PDFDocument.create();
    this.doc.registerFontkit(fontkit);
    // Noto Sans (not a standard PDF font) so non-Latin vacancy languages (e.g. Ukrainian) render correctly.
    this.regular = await this.doc.embedFont(base64ToBytes(NOTO_SANS_REGULAR_BASE64), { subset: true });
    this.bold = await this.doc.embedFont(base64ToBytes(NOTO_SANS_BOLD_BASE64), { subset: true });
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  private ensureSpace(lineHeight: number): void {
    if (this.y - lineHeight < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  private writeLine(text: string, font: PDFFont, size: number, color = INK, indent = 0): void {
    const lineHeight = size * 1.4;
    this.ensureSpace(lineHeight);
    this.page.drawText(text, { x: MARGIN + indent, y: this.y - size, size, font, color });
    this.y -= lineHeight;
  }

  private writeWrapped(text: string, font: PDFFont, size: number, color = INK, indent = 0): void {
    for (const line of wrapText(text, font, size, CONTENT_WIDTH - indent)) {
      this.writeLine(line, font, size, color, indent);
    }
  }

  private spacer(amount: number): void {
    this.y -= amount;
  }

  render(blocks: ResumeBlock[]): void {
    for (const block of blocks) {
      switch (block.kind) {
        case "h1":
          this.writeLine(block.text, this.bold, 20);
          break;
        case "h2":
          this.spacer(6);
          this.writeLine(block.text.toUpperCase(), this.bold, 11, FAINT);
          this.spacer(2);
          break;
        case "h3":
          this.spacer(4);
          this.writeWrapped(block.text, this.bold, 11.5);
          break;
        case "meta":
          this.writeLine(block.text, this.regular, 9.5, FAINT);
          break;
        case "bullet":
          this.writeWrapped(`•  ${block.text}`, this.regular, 10, INK, 8);
          break;
        case "paragraph":
          this.writeWrapped(block.text, this.regular, 10.5);
          break;
      }
    }
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

export async function buildResumePdf(markdown: string): Promise<Uint8Array> {
  const writer = new PdfWriter();
  await writer.init();
  writer.render(parseResumeMarkdown(markdown));
  return writer.save();
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  return new Uint8Array(Buffer.from(value, "base64"));
}
