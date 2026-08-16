export type SharedTargetPayload = {
  file: File | null;
  title: string;
  text: string;
  url: string;
};

function base64ToFile(base64: string, filename: string, mimeType: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename || 'shared.jpg', {
    type: mimeType || 'image/jpeg',
  });
}

/** Read + clear a pending share from the API (sid from redirect query). */
export async function consumeShareTarget(
  sid?: string | null
): Promise<SharedTargetPayload | null> {
  let id = sid?.trim() || '';
  if (!id) {
    try {
      id = sessionStorage.getItem('cobea_share_sid') || '';
    } catch {
      id = '';
    }
  }
  if (!id) return null;

  try {
    sessionStorage.removeItem('cobea_share_sid');
  } catch {
    /* ignore */
  }

  try {
    const res = await fetch(`/api/share-target/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      text?: string;
      url?: string;
      hasFile?: boolean;
      file?: { base64: string; mimeType: string; filename: string } | null;
    };

    let file: File | null = null;
    if (data.file?.base64) {
      file = base64ToFile(
        data.file.base64,
        data.file.filename || 'shared.jpg',
        data.file.mimeType || 'image/jpeg'
      );
    }

    return {
      file,
      title: data.title?.trim() || '',
      text: data.text?.trim() || '',
      url: data.url?.trim() || '',
    };
  } catch (err) {
    console.error('consumeShareTarget', err);
    return null;
  }
}

export function isShareTargetLaunch(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('share-target') === '1';
  } catch {
    return false;
  }
}
