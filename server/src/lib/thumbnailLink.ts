/** Prefer a larger Drive preview (API thumbs are often =s220). */
export function upgradeThumbnailLink(link: string | null | undefined): string | null {
  if (!link) return null;
  if (/=s\d+/i.test(link)) {
    return link.replace(/=s\d+/i, '=s1200');
  }
  if (/googleusercontent\.com/i.test(link)) {
    return `${link}=s1200`;
  }
  return link;
}
