import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useObsTheme } from "@/observability/ObservabilityThemeProvider";
import { useChartData } from "@/observability/hooks/useChartData";
import { createChartRenderer } from "@/observability/lib/chartRenderer";
import type { ChartRenderer } from "@/observability/lib/chartRenderer";
import type { ChartConfig, HookEvent, ObsFilters, TimeRange } from "@/observability/lib/types";
import { getHexColorForSession } from "@/observability/lib/eventColors";

const TIME_RANGES: TimeRange[] = ["1m", "3m", "5m", "10m"];
const SKIPPED_TYPES = new Set(["refresh", "initial"]);

interface Props {
  events: HookEvent[];
  filters: ObsFilters;
  onUpdateUniqueApps: (apps: string[]) => void;
  onUpdateAllApps: (apps: string[]) => void;
  onUpdateTimeRange: (range: TimeRange) => void;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

function formatGap(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getActiveConfig(container: HTMLElement | null): ChartConfig {
  const style = container ? getComputedStyle(container) : null;
  const get = (v: string) => style?.getPropertyValue(v).trim() || "";
  return {
    maxDataPoints: 60,
    animationDuration: 300,
    barWidth: 6,
    barGap: 2,
    colors: {
      primary: get("--theme-primary") || "#3b82f6",
      glow: get("--theme-primary") || "#3b82f6",
      axis: get("--theme-border-primary") || "#e5e7eb",
      text: get("--theme-text-tertiary") || "#6b7280",
    },
  };
}

export function LivePulseChart({ events, filters, onUpdateUniqueApps, onUpdateAllApps, onUpdateTimeRange }: Props) {
  const { containerRef } = useObsTheme();
  const chartData = useChartData(filters);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ChartRenderer | null>(null);
  const renderLoopRef = useRef<number | null>(null);
  const pulseRafsRef = useRef(new Set<number>());
  const mountedRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const themeObserverRef = useRef<MutationObserver | null>(null);
  const processedIds = useRef(new Set<string>());
  const renderRef = useRef<() => void>(() => {});
  const chartDataRef = useRef(chartData);
  const effectiveHeightRef = useRef(0);

  const [chartWidth, setChartWidth] = useState(300);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: "" });

  const effectiveHeight = windowHeight <= 400 ? 210 : 96;

  const render = useCallback(() => {
    if (!rendererRef.current || !mountedRef.current) return;
    const renderer = rendererRef.current;
    const points = chartData.getChartData();
    const maxVal = Math.max(1, ...points.map((p) => p.count));

    renderer.clear();
    renderer.drawBackground();
    renderer.drawAxes();
    renderer.drawTimeLabels(chartData.timeRange);
    renderer.drawBars(
      points,
      maxVal,
      1,
      (eventTypes, toolEvents) => {
        const top = Object.entries(eventTypes).sort((a, b) => b[1] - a[1])[0];
        if (!top) return "";
        const label = top[0];
        if (toolEvents && Object.keys(toolEvents).length > 0) {
          const topTool = Object.entries(toolEvents).sort((a, b) => b[1] - a[1])[0];
          return topTool ? `🔧 ${topTool[0]}` : label;
        }
        return label;
      },
      getHexColorForSession,
    );
  }, [chartData]);

  // Keep latest-render and latest-data refs current before the next RAF fires (C5/C6 fix)
  useLayoutEffect(() => {
    renderRef.current = render;
    chartDataRef.current = chartData;
    effectiveHeightRef.current = effectiveHeight;
  });

  const animateNewEvent = useCallback((x: number, y: number) => {
    if (!rendererRef.current || !mountedRef.current) return;
    const startTime = performance.now();
    const duration = 600;
    let currentId: number;
    const step = (now: number) => {
      pulseRafsRef.current.delete(currentId);
      const progress = Math.min((now - startTime) / duration, 1);
      const opacity = (1 - progress) * 0.6;
      const radius = 5 + progress * 30;
      rendererRef.current?.drawPulseEffect(x, y, radius, opacity);
      if (progress < 1 && mountedRef.current) {
        currentId = requestAnimationFrame(step);
        pulseRafsRef.current.add(currentId);
      }
    };
    currentId = requestAnimationFrame(step);
    pulseRafsRef.current.add(currentId);
  }, []);

  const processNewEvents = useCallback((incoming: HookEvent[]) => {
    for (const event of incoming) {
      if (SKIPPED_TYPES.has(event.hook_event_type)) continue;
      const key = `${event.id ?? ""}-${event.timestamp}`;
      if (processedIds.current.has(key)) continue;
      processedIds.current.add(key);
      chartDataRef.current.addEvent(event);
      if (canvasRef.current && chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        const x = rect.width * 0.9;
        const y = rect.height * 0.5;
        animateNewEvent(x, y);
      }
    }
  }, [animateNewEvent]);

  // Handle events prop changes
  useEffect(() => {
    if (events.length === 0) {
      chartDataRef.current.clearData();
      processedIds.current.clear();
      return;
    }
    processNewEvents(events);
  // processNewEvents is stable (no chartData dep); chartDataRef always current via useLayoutEffect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Emit unique apps upward
  useEffect(() => {
    onUpdateUniqueApps(chartData.uniqueAgentIdsInWindow);
  }, [chartData.uniqueAgentIdsInWindow, onUpdateUniqueApps]);

  useEffect(() => {
    onUpdateAllApps(chartData.allUniqueAgentIds);
  }, [chartData.allUniqueAgentIds, onUpdateAllApps]);

  useEffect(() => {
    onUpdateTimeRange(chartData.timeRange);
  }, [chartData.timeRange, onUpdateTimeRange]);

  // Window resize for height switching
  useEffect(() => {
    const handleWindowResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // Mount: create renderer, observers, render loop
  useEffect(() => {
    mountedRef.current = true;

    const canvas = canvasRef.current;
    const container = chartContainerRef.current;
    if (!canvas || !container) return;

    const cfg = getActiveConfig(containerRef.current);
    const dims = { width: container.clientWidth || 300, height: effectiveHeight, padding: { top: 8, right: 8, bottom: 20, left: 8 } };
    setChartWidth(dims.width);

    try {
      rendererRef.current = createChartRenderer(canvas, dims, cfg);
      rendererRef.current.setDark(containerRef.current?.classList.contains("theme-dark") ?? false);
    } catch {
      return;
    }

    // ResizeObserver on chart container
    resizeObserverRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !rendererRef.current) return;
      const w = entry.contentRect.width;
      setChartWidth(w);
      rendererRef.current.resize({ width: w, height: effectiveHeightRef.current, padding: { top: 8, right: 8, bottom: 20, left: 8 } });
    });
    resizeObserverRef.current.observe(container);

    // MutationObserver for theme changes — observe the obs container (C6)
    themeObserverRef.current = new MutationObserver(() => {
      if (!rendererRef.current) return;
      const newCfg = getActiveConfig(containerRef.current);
      rendererRef.current.setConfig(newCfg);
      rendererRef.current.setDark(containerRef.current?.classList.contains("theme-dark") ?? false);
      renderRef.current();
    });
    if (containerRef.current) {
      themeObserverRef.current.observe(containerRef.current, { attributes: true, attributeFilter: ["class", "style"] });
    }

    // 30fps render loop (C5) — uses renderRef.current() to always call the latest render closure
    let lastRenderTime = 0;
    const frameInterval = 1000 / 30;
    const renderLoop = (currentTime: number) => {
      if (!mountedRef.current) return;
      const delta = currentTime - lastRenderTime;
      if (delta >= frameInterval) {
        renderRef.current();
        lastRenderTime = currentTime - (delta % frameInterval);
      }
      renderLoopRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoopRef.current = requestAnimationFrame(renderLoop);

    const pulseRafs = pulseRafsRef.current;
    return () => {
      mountedRef.current = false;
      if (renderLoopRef.current) { cancelAnimationFrame(renderLoopRef.current); renderLoopRef.current = null; }
      pulseRafs.forEach((id) => cancelAnimationFrame(id));
      pulseRafs.clear();
      resizeObserverRef.current?.disconnect();
      themeObserverRef.current?.disconnect();
      rendererRef.current = null;
      chartData.cleanup();
    };
  // mount/unmount only — render and effectiveHeight intentionally excluded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const points = chartData.getChartData();
    const barCount = 60;
    const chartAreaWidth = rect.width - 16;
    const totalBarWidth = chartAreaWidth / barCount;
    const bucketIdx = Math.floor((x - 8) / totalBarWidth);
    const pt = points[bucketIdx];
    if (pt && pt.count > 0) {
      const topType = pt.eventTypes ? Object.entries(pt.eventTypes).sort((a, b) => b[1] - a[1])[0] : null;
      setTooltip({ visible: true, x, y, content: `${pt.count} events${topType ? ` · ${topType[0]}` : ""}` });
    } else {
      setTooltip((prev) => ({ ...prev, visible: false }));
    }
  }, [chartData]);

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleTimeRangeKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = TIME_RANGES.indexOf(chartData.timeRange);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      chartData.setTimeRange(TIME_RANGES[Math.min(idx + 1, TIME_RANGES.length - 1)]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      chartData.setTimeRange(TIME_RANGES[Math.max(idx - 1, 0)]);
    } else if (e.key === "Home") {
      chartData.setTimeRange(TIME_RANGES[0]);
    } else if (e.key === "End") {
      chartData.setTimeRange(TIME_RANGES[TIME_RANGES.length - 1]);
    }
  }, [chartData]);

  const hasData = chartData.getChartData().some((p) => p.count > 0);

  return (
    <div className="shrink-0 border-b" style={{ borderColor: "var(--theme-border-primary)", background: "var(--theme-bg-secondary)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: "var(--theme-text-primary)" }}>📊 Activity</span>
        {/* Stat badges */}
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--theme-bg-tertiary)", color: "var(--theme-text-secondary)" }}>
          👥 {chartData.uniqueAgentCount}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--theme-bg-tertiary)", color: "var(--theme-text-secondary)" }}>
          ⚡ {chartData.eventTimingMetrics.count}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--theme-bg-tertiary)", color: "var(--theme-text-secondary)" }}>
          🔧 {chartData.toolCallCount}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--theme-bg-tertiary)", color: "var(--theme-text-secondary)" }}>
          🕐 {formatGap(chartData.eventTimingMetrics.avgGapMs)}
        </span>
        {/* Time range buttons */}
        <div
          className="ml-auto flex items-center gap-1"
          role="group"
          aria-label="Time range"
          tabIndex={0}
          onKeyDown={handleTimeRangeKeyDown}
        >
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => chartData.setTimeRange(r)}
              className="text-xs px-2 py-0.5 rounded transition-colors"
              style={
                chartData.timeRange === r
                  ? { background: "var(--theme-primary)", color: "var(--theme-bg-primary)" }
                  : { background: "var(--theme-bg-tertiary)", color: "var(--theme-text-secondary)" }
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas area */}
      <div ref={chartContainerRef} className="relative w-full" style={{ height: `${effectiveHeight}px` }}>
        <canvas
          ref={canvasRef}
          width={chartWidth}
          height={effectiveHeight}
          className="block w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {/* Empty state */}
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs" style={{ color: "var(--theme-text-quaternary)" }}>⏳ Waiting for events...</span>
          </div>
        )}
        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute text-xs px-2 py-1 rounded pointer-events-none"
            style={{
              left: tooltip.x + 8,
              top: tooltip.y - 28,
              background: "var(--theme-bg-primary)",
              color: "var(--theme-text-primary)",
              border: "1px solid var(--theme-border-primary)",
              boxShadow: "0 2px 8px var(--theme-shadow)",
              whiteSpace: "nowrap",
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>
    </div>
  );
}
