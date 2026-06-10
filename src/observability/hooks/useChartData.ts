import { useEffect, useRef, useState } from "react";
import type { HookEvent, ChartDataPoint, ObsFilters, TimeRange } from "@/observability/lib/types";

const TIME_RANGE_MS: Record<TimeRange, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "10m": 600_000,
};

const DATA_POINTS_COUNT = 60;

interface ComputedMetrics {
  uniqueAgentIdsInWindow: string[];
  allUniqueAgentIds: string[];
  uniqueAgentCount: number;
  toolCallCount: number;
  eventTimingMetrics: { avgGapMs: number; count: number };
}

function computeMetrics(events: HookEvent[], range: TimeRange): ComputedMetrics {
  const now = Date.now();
  const windowMs = TIME_RANGE_MS[range];

  const inWindowIds = new Set<string>();
  const allIds = new Set<string>();
  const uniqueApps = new Set<string>();
  let toolCount = 0;
  const sorted: HookEvent[] = [];

  for (const e of events) {
    allIds.add(`${e.source_app}:${e.session_id.slice(0, 8)}`);
    const age = now - e.timestamp;
    if (age < windowMs) {
      inWindowIds.add(`${e.source_app}:${e.session_id.slice(0, 8)}`);
      uniqueApps.add(e.source_app);
      if (e.hook_event_type === "PreToolUse" || e.hook_event_type === "PostToolUse") toolCount++;
      sorted.push(e);
    }
  }

  sorted.sort((a, b) => a.timestamp - b.timestamp);
  let avgGapMs = 0;
  if (sorted.length >= 2) {
    let total = 0;
    for (let i = 1; i < sorted.length; i++) total += sorted[i].timestamp - sorted[i - 1].timestamp;
    avgGapMs = total / (sorted.length - 1);
  }

  return {
    uniqueAgentIdsInWindow: Array.from(inWindowIds),
    allUniqueAgentIds: Array.from(allIds),
    uniqueAgentCount: uniqueApps.size,
    toolCallCount: toolCount,
    eventTimingMetrics: { avgGapMs, count: sorted.length },
  };
}

function getBucketIndex(timestamp: number, now: number, windowMs: number): number {
  const bucketMs = windowMs / DATA_POINTS_COUNT;
  const age = now - timestamp;
  if (age < 0 || age >= windowMs) return -1;
  return Math.floor((windowMs - age) / bucketMs);
}

function makeEmptyDataPoints(range: TimeRange): ChartDataPoint[] {
  const now = Date.now();
  const windowMs = TIME_RANGE_MS[range];
  const bucketMs = windowMs / DATA_POINTS_COUNT;
  return Array.from({ length: DATA_POINTS_COUNT }, (_, i) => ({
    timestamp: now - windowMs + i * bucketMs,
    count: 0,
    eventTypes: {},
    toolEvents: {},
    sessions: {},
  }));
}

function buildDataPoints(events: HookEvent[], range: TimeRange): ChartDataPoint[] {
  const points = makeEmptyDataPoints(range);
  const now = Date.now();
  const windowMs = TIME_RANGE_MS[range];
  for (const event of events) {
    const idx = getBucketIndex(event.timestamp, now, windowMs);
    if (idx < 0) continue;
    const pt = points[idx];
    if (!pt) continue;
    pt.count++;
    pt.eventTypes ??= {};
    pt.eventTypes[event.hook_event_type] = (pt.eventTypes[event.hook_event_type] ?? 0) + 1;
    if (event.tool_name) {
      pt.toolEvents ??= {};
      pt.toolEvents[event.tool_name] = (pt.toolEvents[event.tool_name] ?? 0) + 1;
    }
    pt.sessions ??= {};
    pt.sessions[event.session_id] = (pt.sessions[event.session_id] ?? 0) + 1;
  }
  return points;
}

function parseAgentIdFilter(filter: string): { sourceApp: string; sessionPrefix: string } | null {
  const colonIdx = filter.lastIndexOf(":");
  if (colonIdx === -1) return null;
  return { sourceApp: filter.slice(0, colonIdx), sessionPrefix: filter.slice(colonIdx + 1) };
}

function eventMatchesFilter(event: HookEvent, filters: ObsFilters, agentIdFilter?: string): boolean {
  if (filters.sourceApp && event.source_app !== filters.sourceApp) return false;
  if (filters.sessionId && !event.session_id.startsWith(filters.sessionId)) return false;
  if (filters.eventType && event.hook_event_type !== filters.eventType) return false;
  if (agentIdFilter) {
    const parsed = parseAgentIdFilter(agentIdFilter);
    if (parsed) {
      if (event.source_app !== parsed.sourceApp) return false;
      if (!event.session_id.startsWith(parsed.sessionPrefix)) return false;
    }
  }
  return true;
}

const EMPTY_METRICS: ComputedMetrics = {
  uniqueAgentIdsInWindow: [],
  allUniqueAgentIds: [],
  uniqueAgentCount: 0,
  toolCallCount: 0,
  eventTimingMetrics: { avgGapMs: 0, count: 0 },
};

export function useChartData(filters: ObsFilters, agentIdFilter?: string) {
  const allEvents = useRef<HookEvent[]>([]);
  const dataPoints = useRef<ChartDataPoint[]>([]);
  const eventBuffer = useRef<HookEvent[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIds = useRef(new Set<string>());
  const timeRangeRef = useRef<TimeRange>("1m");
  const filtersRef = useRef<ObsFilters>(filters);
  const agentIdFilterRef = useRef<string | undefined>(agentIdFilter);

  const [timeRange, setTimeRangeState] = useState<TimeRange>("1m");
  const [metrics, setMetrics] = useState<ComputedMetrics>(EMPTY_METRICS);

  // Keep refs in sync with latest props/state for use inside callbacks (must be in effect, not render body)
  useEffect(() => {
    filtersRef.current = filters;
    agentIdFilterRef.current = agentIdFilter;
  });

  function getFiltered(): HookEvent[] {
    return allEvents.current.filter((e) =>
      eventMatchesFilter(e, filtersRef.current, agentIdFilterRef.current),
    );
  }

  function flushAndUpdate(range: TimeRange) {
    const filtered = getFiltered();
    dataPoints.current = buildDataPoints(filtered, range);
    setMetrics(computeMetrics(allEvents.current, range));
  }

  function processEventBuffer() {
    if (eventBuffer.current.length === 0) return;
    const range = timeRangeRef.current;
    const now = Date.now();
    const windowMs = TIME_RANGE_MS[range] * 2;
    for (const event of eventBuffer.current) {
      allEvents.current.push(event);
    }
    eventBuffer.current = [];
    allEvents.current = allEvents.current.filter((e) => now - e.timestamp < windowMs);
    flushAndUpdate(range);
  }

  function addEvent(event: HookEvent) {
    const key = `${event.id ?? ""}-${event.timestamp}`;
    if (seenIds.current.has(key)) return;
    seenIds.current.add(key);
    eventBuffer.current.push(event);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      processEventBuffer();
      debounceTimer.current = null;
    }, 100);
  }

  function getChartData(): ChartDataPoint[] {
    return dataPoints.current;
  }

  function setTimeRange(range: TimeRange) {
    timeRangeRef.current = range;
    setTimeRangeState(range);
    flushAndUpdate(range);
  }

  function clearData() {
    allEvents.current = [];
    dataPoints.current = makeEmptyDataPoints(timeRangeRef.current);
    eventBuffer.current = [];
    seenIds.current.clear();
    setMetrics(EMPTY_METRICS);
  }

  function cleanup() {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    processEventBuffer();
  }

  useEffect(() => {
    const id = setInterval(() => {
      const range = timeRangeRef.current;
      const now = Date.now();
      const windowMs = TIME_RANGE_MS[range] * 2;
      const before = allEvents.current.length;
      allEvents.current = allEvents.current.filter((e) => now - e.timestamp < windowMs);
      if (allEvents.current.length !== before) {
        flushAndUpdate(range);
      }
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    timeRange,
    addEvent,
    getChartData,
    setTimeRange,
    cleanup,
    clearData,
    uniqueAgentCount: metrics.uniqueAgentCount,
    uniqueAgentIdsInWindow: metrics.uniqueAgentIdsInWindow,
    allUniqueAgentIds: metrics.allUniqueAgentIds,
    toolCallCount: metrics.toolCallCount,
    eventTimingMetrics: metrics.eventTimingMetrics,
  };
}
