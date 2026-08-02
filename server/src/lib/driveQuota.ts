import { prisma } from './prisma.js';

/**
 * Google Drive API free daily billing threshold (quota units).
 * @see https://developers.google.com/workspace/drive/api/guides/limits
 */
export const DRIVE_DAILY_FREE_UNITS = 400_000_000;

/** Per-method quota units (Drive API v3). */
export const DRIVE_UNIT_COST = {
  read: 5, // files.get metadata
  list: 100, // files.list
  download: 200, // files.get alt=media, files.export
  edit: 50, // create / update / delete
  other: 5,
} as const;

export type DriveCallKind = keyof typeof DRIVE_UNIT_COST;

type DayBucket = {
  day: string;
  requests: number;
  units: number;
};

let memory: DayBucket | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function ensureMemory(): DayBucket {
  const day = utcDay();
  if (!memory || memory.day !== day) {
    memory = { day, requests: 0, units: 0 };
  }
  return memory;
}

async function loadFromDb(): Promise<DayBucket> {
  const day = utcDay();
  const row = await prisma.driveApiUsage.findUnique({ where: { id: 'global' } });
  if (row && row.day === day) {
    memory = { day: row.day, requests: row.requests, units: row.units };
  } else {
    memory = { day, requests: 0, units: 0 };
  }
  return memory;
}

async function flushToDb(): Promise<void> {
  if (!memory) return;
  const snapshot = { ...memory };
  await prisma.driveApiUsage.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      day: snapshot.day,
      requests: snapshot.requests,
      units: snapshot.units,
    },
    update: {
      day: snapshot.day,
      requests: snapshot.requests,
      units: snapshot.units,
    },
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushing = flushToDb()
      .catch((err) => console.error('Drive quota flush failed', err))
      .finally(() => {
        flushing = null;
      });
  }, 1500);
}

/** Record one Drive API request (fire-and-forget safe). */
export function recordDriveCall(kind: DriveCallKind): void {
  const bucket = ensureMemory();
  const today = utcDay();
  if (bucket.day !== today) {
    bucket.day = today;
    bucket.requests = 0;
    bucket.units = 0;
  }
  bucket.requests += 1;
  bucket.units += DRIVE_UNIT_COST[kind];
  scheduleFlush();
}

export type DriveUsageSnapshot = {
  day: string;
  requests: number;
  units: number;
  dailyLimitUnits: number;
  percentUsed: number;
};

export async function getDriveUsageSnapshot(): Promise<DriveUsageSnapshot> {
  if (!memory || memory.day !== utcDay()) {
    try {
      await loadFromDb();
    } catch (err) {
      console.error('Drive quota load failed', err);
      ensureMemory();
    }
  }
  if (flushing) await flushing.catch(() => undefined);

  const bucket = ensureMemory();
  const percentUsed =
    DRIVE_DAILY_FREE_UNITS > 0
      ? Math.min(100, (bucket.units / DRIVE_DAILY_FREE_UNITS) * 100)
      : 0;

  return {
    day: bucket.day,
    requests: bucket.requests,
    units: bucket.units,
    dailyLimitUnits: DRIVE_DAILY_FREE_UNITS,
    percentUsed: Math.round(percentUsed * 1000) / 1000,
  };
}
