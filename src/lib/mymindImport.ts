import { parseCsvObjects } from './parseCsv';
import { api, type MyMindImportRow } from './api';

export type MyMindCsvRow = {
  id: string;
  type: string;
  title: string;
  url: string;
  content: string;
  note: string;
  tags: string;
  created: string;
};

const BATCH_SIZE = 40;

function parseTags(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function fileStem(name: string): string {
  const base = name.split(/[/\\]/).pop() || name;
  return base.replace(/\.[^.]+$/, '');
}

export function parseMyMindCsv(text: string): MyMindCsvRow[] {
  return parseCsvObjects(text)
    .filter((row) => row.id?.trim())
    .map((row) => ({
      id: row.id.trim(),
      type: row.type?.trim() || 'WebPage',
      title: row.title ?? '',
      url: row.url ?? '',
      content: row.content ?? '',
      note: row.note ?? '',
      tags: row.tags ?? '',
      created: row.created ?? '',
    }));
}

export function indexMyMindImages(files: File[]): Map<string, File> {
  const map = new Map<string, File>();
  for (const file of files) {
    if (file.name === 'cards.csv') continue;
    map.set(fileStem(file.name), file);
  }
  return map;
}

export type MyMindImportProgress = {
  done: number;
  total: number;
  message: string;
};

export async function importMyMindFolder(
  files: File[],
  onProgress?: (progress: MyMindImportProgress) => void
): Promise<{ imported: number; failed: number }> {
  const csvFile = files.find((f) => f.name === 'cards.csv');
  if (!csvFile) throw new Error('cards.csv introuvable dans le dossier sélectionné');

  const csvText = await csvFile.text();
  const rows = parseMyMindCsv(csvText);
  if (rows.length === 0) throw new Error('cards.csv est vide ou invalide');

  const imagesById = indexMyMindImages(files);
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const manifest: MyMindImportRow[] = slice.map((row) => ({
      mymindId: row.id,
      type: row.type,
      title: row.title,
      url: row.url,
      content: row.content,
      note: row.note,
      tags: parseTags(row.tags),
      created: row.created || undefined,
    }));

    const batchFiles: File[] = [];
    for (const row of slice) {
      const image = imagesById.get(row.id);
      if (image) batchFiles.push(image);
    }

    onProgress?.({
      done: i,
      total: rows.length,
      message: `Import ${i + 1}–${Math.min(i + slice.length, rows.length)} / ${rows.length}`,
    });

    try {
      const result = await api.importMyMindBatch(manifest, batchFiles);
      imported += result.imported;
      failed += result.failed;
    } catch {
      failed += slice.length;
    }
  }

  onProgress?.({
    done: rows.length,
    total: rows.length,
    message: `Terminé — ${imported} importées`,
  });

  return { imported, failed };
}
