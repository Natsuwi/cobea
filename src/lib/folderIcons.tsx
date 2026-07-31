import React from 'react';
import {
  Folder,
  Briefcase,
  Heart,
  Star,
  Home,
  Camera,
  Book,
  Music,
  Code,
  Coffee,
  Plane,
  Palette,
  Lightbulb,
  Mountain,
  Bookmark,
  type LucideIcon,
} from 'lucide-react';

export const FOLDER_ICON_OPTIONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'folder', icon: Folder, label: 'Dossier' },
  { id: 'briefcase', icon: Briefcase, label: 'Travail' },
  { id: 'heart', icon: Heart, label: 'Cœur' },
  { id: 'star', icon: Star, label: 'Étoile' },
  { id: 'home', icon: Home, label: 'Maison' },
  { id: 'camera', icon: Camera, label: 'Photo' },
  { id: 'book', icon: Book, label: 'Livre' },
  { id: 'music', icon: Music, label: 'Musique' },
  { id: 'code', icon: Code, label: 'Code' },
  { id: 'coffee', icon: Coffee, label: 'Café' },
  { id: 'plane', icon: Plane, label: 'Voyage' },
  { id: 'palette', icon: Palette, label: 'Art' },
  { id: 'lightbulb', icon: Lightbulb, label: 'Idée' },
  { id: 'mountain', icon: Mountain, label: 'Nature' },
  { id: 'bookmark', icon: Bookmark, label: 'Signet' },
];

const iconMap = Object.fromEntries(
  FOLDER_ICON_OPTIONS.map((o) => [o.id, o.icon])
) as Record<string, LucideIcon>;

export function FolderIcon({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  const Icon = iconMap[name || 'folder'] || Folder;
  return <Icon className={className} />;
}
