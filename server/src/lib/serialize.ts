import type { Card, CardFile, Folder, Profile } from '@prisma/client';
import { env } from './env.js';

export type CardWithFile = Card & { file: CardFile | null };

function mediaUrl(cardId: string, kind: 'file' | 'thumb' | 'drawing'): string {
  const base = env.PUBLIC_API_URL.replace(/\/$/, '');
  const path = `/api/cards/${cardId}/${kind}`;
  return base ? `${base}${path}` : path;
}

/** Shape expected by the Cobea frontend ImageItem */
export function serializeCard(card: CardWithFile) {
  const file = card.file;
  let url = card.url;

  if (card.kind === 'image') {
    if (file?.data) {
      url = mediaUrl(card.id, 'file');
    } else if (file?.thumbnailData) {
      url = mediaUrl(card.id, 'thumb');
    } else if (file?.thumbnailLink) {
      url = mediaUrl(card.id, 'thumb');
    } else if (!url && file?.driveFileId) {
      url = mediaUrl(card.id, 'file');
    }
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
    markdown: card.markdown ?? undefined,
    additionalNotes: card.additionalNotes ?? undefined,
    folderId: card.folderId,
    drawingData: file?.drawingData ? mediaUrl(card.id, 'drawing') : undefined,
    moodboardPlacements: card.moodboardPlacements ?? undefined,
    hasFile: Boolean(file?.data || file?.driveFileId),
    mimeType: file?.mimeType,
    driveFileId: file?.driveFileId ?? undefined,
  };
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
