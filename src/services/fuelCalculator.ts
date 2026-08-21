import { FuelFillup } from '../types';

const MOVING_WINDOW = 5;
const OUTLIER_THRESHOLD_PCT = 0.3;
const TREND_STABLE_PCT = 0.05;
const NO_TYPE = 'Sem tipo';

export interface FuelSegment {
  id: string; // closing (tanque cheio) entry id
  closingEntry: FuelFillup;
  kmDriven: number;
  litersTotal: number;
  costTotal: number;
  average: number; // km/L
  costPerKm: number;
  entryIds: string[];
  isOutlier: boolean;
  outlierDeviationPct: number | null;
  mixedFuel: boolean;
  fuelType: string;
}

export interface FuelTypeStats {
  fuelType: string;
  segments: FuelSegment[]; // homogeneous segments of this type, newest first
  latestAverage: number | null;
  movingAverage: number | null;
  overallAverage: number | null;
  trend: 'up' | 'down' | 'stable' | null;
}

export interface FuelStats {
  allSegments: FuelSegment[]; // newest first, any type
  byFuelType: FuelTypeStats[];
  pendingEntry: FuelFillup | null;
  firstEntryIsReference: boolean;
}

function chronological(entries: FuelFillup[]): FuelFillup[] {
  return [...entries].sort((a, b) => (a.date ?? a.createdAt) - (b.date ?? b.createdAt));
}

/**
 * Distance covered since the previous entry: prefers the odometer reading
 * (precise, what new fill-ups should use) and falls back to the manually
 * typed "km rodado" field for legacy rows that predate odometer tracking.
 */
function distanceSincePrevious(entry: FuelFillup, prev: FuelFillup | null): number {
  if (!prev) return 0;
  if (entry.km != null && prev.km != null) return entry.km - prev.km;
  return entry.kmDriven ?? 0;
}

function buildSegments(entries: FuelFillup[]): FuelSegment[] {
  const sorted = chronological(entries);
  const segments: FuelSegment[] = [];
  let buffer: FuelFillup[] = [];
  let bufferKm = 0;
  let sawFullTank = false;

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    buffer.push(e);
    bufferKm += distanceSincePrevious(e, prev);

    if (!e.fullTank) continue;

    if (sawFullTank) {
      const litersTotal = buffer.reduce((s, x) => s + (x.liters ?? 0), 0);
      const costTotal = buffer.reduce((s, x) => s + x.totalValue, 0);
      const kmDriven = bufferKm;
      const types = new Set(buffer.map(x => (x.fuelType?.trim() || NO_TYPE)));
      segments.push({
        id: e.id,
        closingEntry: e,
        kmDriven,
        litersTotal,
        costTotal,
        average: kmDriven > 0 && litersTotal > 0 ? kmDriven / litersTotal : 0,
        costPerKm: kmDriven > 0 ? costTotal / kmDriven : 0,
        entryIds: buffer.map(x => x.id),
        isOutlier: kmDriven <= 0,
        outlierDeviationPct: null,
        mixedFuel: types.size > 1,
        fuelType: e.fuelType?.trim() || NO_TYPE,
      });
    }

    sawFullTank = true;
    buffer = [];
    bufferKm = 0;
  }

  return segments.reverse(); // newest first
}

/** Flags outliers by comparing each segment to the trailing window of prior closed segments (chronological order). */
function withOutliers(segmentsNewestFirst: FuelSegment[]): FuelSegment[] {
  const chron = [...segmentsNewestFirst].reverse();
  const flagged = chron.map((seg, idx) => {
    if (seg.kmDriven <= 0) return { ...seg, isOutlier: true, outlierDeviationPct: null };
    const prior = chron.slice(Math.max(0, idx - MOVING_WINDOW), idx).filter(p => p.average > 0);
    if (prior.length < 2) return { ...seg, isOutlier: false, outlierDeviationPct: null };
    const refAvg = prior.reduce((s, p) => s + p.average, 0) / prior.length;
    const deviation = (seg.average - refAvg) / refAvg;
    return { ...seg, outlierDeviationPct: deviation, isOutlier: Math.abs(deviation) > OUTLIER_THRESHOLD_PCT };
  });
  return flagged.reverse();
}

function weightedAverage(segments: FuelSegment[]): number | null {
  const valid = segments.filter(s => s.average > 0);
  if (valid.length === 0) return null;
  const km = valid.reduce((s, v) => s + v.kmDriven, 0);
  const liters = valid.reduce((s, v) => s + v.litersTotal, 0);
  return liters > 0 ? km / liters : null;
}

function trendOf(latestAverage: number | null, movingAverage: number | null): 'up' | 'down' | 'stable' | null {
  if (latestAverage === null || movingAverage === null || movingAverage === 0) return null;
  const diff = (latestAverage - movingAverage) / movingAverage;
  if (Math.abs(diff) < TREND_STABLE_PCT) return 'stable';
  return diff > 0 ? 'up' : 'down';
}

function statsForType(fuelType: string, allSegments: FuelSegment[]): FuelTypeStats {
  const segments = allSegments.filter(s => s.fuelType === fuelType && !s.mixedFuel);
  const latestAverage = segments[0]?.average || null;
  const movingAverage = weightedAverage(segments.slice(0, MOVING_WINDOW));
  const overallAverage = weightedAverage(segments);
  return { fuelType, segments, latestAverage, movingAverage, overallAverage, trend: trendOf(latestAverage, movingAverage) };
}

export const fuelCalculator = {
  MOVING_WINDOW,
  OUTLIER_THRESHOLD_PCT,
  NO_TYPE,

  segments(entries: FuelFillup[]): FuelSegment[] {
    return withOutliers(buildSegments(entries));
  },

  pendingEntry(entries: FuelFillup[]): { entry: FuelFillup | null; isFirstEverReference: boolean } {
    const sorted = chronological(entries);
    if (sorted.length === 0) return { entry: null, isFirstEverReference: false };
    const last = sorted[sorted.length - 1];
    if (last.fullTank) {
      const fullCount = sorted.filter(e => e.fullTank).length;
      return { entry: null, isFirstEverReference: sorted.length === 1 && fullCount === 1 };
    }
    return { entry: last, isFirstEverReference: false };
  },

  byFuelType(entries: FuelFillup[]): FuelTypeStats[] {
    const allSegments = this.segments(entries);
    const types = [...new Set(allSegments.filter(s => !s.mixedFuel).map(s => s.fuelType))];
    return types.map(t => statsForType(t, allSegments)).sort((a, b) => (b.overallAverage ?? 0) - (a.overallAverage ?? 0));
  },

  tripStats(entries: FuelFillup[]): FuelStats {
    const allSegments = this.segments(entries);
    const { entry: pendingEntry, isFirstEverReference } = this.pendingEntry(entries);
    return {
      allSegments,
      byFuelType: this.byFuelType(entries),
      pendingEntry,
      firstEntryIsReference: isFirstEverReference,
    };
  },

  /** Most recent closed segment's stats, any fuel type — replaces the old per-pair lastFuelStats(). */
  lastSegmentStats(entries: FuelFillup[]): { kmL: number; costPerKm: number } | null {
    const seg = this.segments(entries)[0];
    if (!seg || seg.average <= 0) return null;
    return { kmL: seg.average, costPerKm: seg.costPerKm };
  },

  /** Row-level display map: entry id (the closing/tanque-cheio entry) -> segment stats. */
  statsByEntry(entries: FuelFillup[]): Record<string, { kmL: number; costPerKm: number }> {
    const map: Record<string, { kmL: number; costPerKm: number }> = {};
    for (const seg of this.segments(entries)) {
      if (seg.average > 0) map[seg.id] = { kmL: seg.average, costPerKm: seg.costPerKm };
    }
    return map;
  },

  /** Best average per bandeira (brand), using the closing entry's flag for each homogeneous-type segment. Best first. */
  bestByFlag(entries: FuelFillup[]): { flag: string; kmL: number }[] {
    const segs = this.segments(entries).filter(s => s.average > 0);
    const byFlag = new Map<string, FuelSegment[]>();
    for (const s of segs) {
      const flag = s.closingEntry.flag?.trim() || 'Sem bandeira';
      byFlag.set(flag, [...(byFlag.get(flag) ?? []), s]);
    }
    return [...byFlag.entries()]
      .map(([flag, list]) => ({ flag, kmL: weightedAverage(list) ?? 0 }))
      .filter(x => x.kmL > 0)
      .sort((a, b) => b.kmL - a.kmL);
  },
};
