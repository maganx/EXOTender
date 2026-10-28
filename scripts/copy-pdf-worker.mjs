// pdf.js runs its parser in a web worker; serve the worker file from /public.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
