import type { Card, CardFile, Folder, Profile } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { env } from './env.js';
import { prisma } from './prisma.js';

export type CardWithFile = Card & { file: CardFile | null };

/** Lightweight file fields for gallery list (no BLOBs). */
export type CardFileSummary = {
  mimeType: string;
  filename: string;
  driveFileId: string | null;
  thumbnailLink: string | null;
  hasData: boolean;
  hasThumbnail: boolean;
  hasDrawing: boolean;
};

export type CardForList = Card & { file: CardFileSummary | null };

function mediaUrl(cardId: string, kind: 'file' | 'thumb' | 'drawing', version?: number): string {
  const base = env.PUBLIC_API_URL.replace(/\/$/, '');
  const path = `/api/cards/${cardId}/${kind}`;
  const url = base ? `${base}${path}` : path;
  if (kind === 'drawing' && version) {
    return `${url}?v=${version}`;
  }
  return url;
}

function buildCardPayload(
  card: Card,
  file: {
    mimeType?: string;
    filename?: string;
    driveFileId?: string | null;
    hasData: boolean;
    hasThumbnail: boolean;
    hasDrawing: boolean;
  } | null,
  opts?: { truncateText?: boolean }
) {
  let url = card.url;

  if (card.kind === 'image') {
    if (file?.hasData) {
      url = mediaUrl(card.id, 'file');
    } else if (file?.hasThumbnail) {
      url = mediaUrl(card.id, 'thumb');
    } else {
      url = url || '';
    }
  }

  const driveFileId = file?.driveFileId ?? undefined;
  const truncate = opts?.truncateText !== false;
  let markdown = card.markdown ?? undefined;
  let additionalNotes = card.additionalNotes ?? undefined;
  if (truncate && markdown && markdown.length > 800) {
    markdown = `${markdown.slice(0, 800)}…`;
  }
  if (truncate && additionalNotes && additionalNotes.length > 400) {
    additionalNotes = `${additionalNotes.slice(0, 400)}…`;
  }

  return {
    id: card.id,
    url,
    title: card.title,
    aspectRatio: card.aspectRatio ?? undefined,
    tags: card.tags,
    dominantColor: card.dominantColor ?? undefined,
    createdAt: card.createdAt.getTime(),
    isFavorite: card.isFavorite,
    width: card.width ?? undefined,
    height: card.height ?? undefined,
    source: card.source,
    kind: card.kind,
    markdown,
    additionalNotes,
    folderId: card.folderId,
    drawingData: file?.hasDrawing
      ? mediaUrl(card.id, 'drawing', card.updatedAt.getTime())
      : undefined,
    moodboardPlacements: card.moodboardPlacements ?? undefined,
    hasFile: Boolean(file?.hasData || file?.driveFileId),
    hasLocalFile: Boolean(file?.hasData),
    mimeType: file?.mimeType,
    filename: file?.filename,
    driveFileId,
    driveUrl: driveFileId
      ? `https://drive.google.com/file/d/${driveFileId}/view`
      : undefined,
  };
}

/** Full card (detail / mutations) — may include file row with blobs in memory. */
export function serializeCard(card: CardWithFile) {
  const file = card.file;
  return buildCardPayload(
    card,
    file
      ? {
          mimeType: file.mimeType,
          filename: file.filename,
          driveFileId: file.driveFileId,
          hasData: Boolean(file.data),
          hasThumbnail: Boolean(file.thumbnailData),
          hasDrawing: Boolean(file.drawingData),
        }
      : null,
    { truncateText: false }
  );
}

/** Gallery list — never loads BYTEA columns from Postgres. */
export async function listSerializedCards(profileId: string) {
  const cards = await prisma.card.findMany({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
    include: {
      file: {
        select: {
          id: true,
          mimeType: true,
          filename: true,
          driveFileId: true,
          thumbnailLink: true,
        },
      },
    },
  });

  const fileIds = cards
    .map((c) => c.file?.id)
    .filter((id): id is string => Boolean(id));

  const flags = new Map<
    string,
    { hasData: boolean; hasThumbnail: boolean; hasDrawing: boolean }
  >();

  if (fileIds.length > 0) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        has_data: boolean | number;
        has_thumb: boolean | number;
        has_drawing: boolean | number;
      }>
    >`
      SELECT
        id,
        (data IS NOT NULL) AS has_data,
        (thumbnail_data IS NOT NULL) AS has_thumb,
        (drawing_data IS NOT NULL) AS has_drawing
      FROM card_files
      WHERE id IN (${Prisma.join(fileIds)})
    `;
    for (const row of rows) {
      flags.set(row.id, {
        hasData: row.has_data === true || row.has_data === 1,
        hasThumbnail: row.has_thumb === true || row.has_thumb === 1,
        hasDrawing: row.has_drawing === true || row.has_drawing === 1,
      });
    }
  }

  return cards.map((card) => {
    const f = card.file;
    const flag = f ? flags.get(f.id) : undefined;
    return buildCardPayload(
      card,
      f
        ? {
            mimeType: f.mimeType,
            filename: f.filename,
            driveFileId: f.driveFileId,
            hasData: flag?.hasData ?? false,
            hasThumbnail: flag?.hasThumbnail ?? false,
            hasDrawing: flag?.hasDrawing ?? false,
          }
        : null,
      { truncateText: true }
    );
  });
}

export function serializeFolder(folder: Folder) {
  return {
    id: folder.id,
    name: folder.name,
    icon: folder.icon,
    createdAt: folder.createdAt.getTime(),
  };
}

export function serializeProfile(profile: Profile) {
  return {
    id: profile.id,
    name: profile.name,
    avatarUrl: profile.avatarUrl ?? '',
    theme: profile.theme,
  };
}
