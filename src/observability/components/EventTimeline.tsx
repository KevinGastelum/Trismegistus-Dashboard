import { useRef, useEffect, useLayoutEffect } from "react";
import type { HookEvent, ObsFilters } from "@/observability/lib/types";
import {
  getGradientForSession,
  getColorForSession,
  getColorForApp,
  getHexColorForApp,
} from "@/observability/lib/eventColors";
import { useEventSearch } from "@/observability/hooks/useEventSearch";
import { EventRow } from "@/observability/components/EventRow";

interface Props {
  events: HookEvent[];
  filters: ObsFilters;
  stickToBottom: boolean;
  onStickToBottomChange: (v: boolean) => void;
  uniqueAppNames?: string[];
  allAppNames?: string[];
  onSelectAgent: (id: string) => void;
}

export function EventTimeline({
  events,
  filters,
  stickToBottom,
  onStickToBottomChange,
  uniqueAppNames,
  allAppNames,
  onSelectAgent,
}: Props) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { searchPattern, searchError, searchEvents, updateSearchPattern, clearSearch } =
    useEventSearch();

  const filteredEvents = (() => {
    let result = events;
    if (filters.sourceApp) result = result.filter((e) => e.source_app === filters.sourceApp);
    if (filters.sessionId) result = result.filter((e) => e.session_id === filters.sessionId);
    if (filters.eventType) result = result.filter((e) => e.hook_event_type === filters.eventType);
    return searchEvents(result, searchPattern);
  })();

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (isAtBottom !== stickToBottom) onStickToBottomChange(isAtBottom);
  };

  useEffect(() => {
    if (!stickToBottom) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [events.length, stickToBottom]);

  useLayoutEffect(() => {
    if (!stickToBottom) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [stickToBottom]);

  const displayedAgentIds = allAppNames?.length ? allAppNames : (uniqueAppNames ?? []);

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      <div className="px-3 py-3 bg-gradient-to-r from-[var(--theme-bg-primary)] to-[var(--theme-bg-secondary)] shadow-lg shrink-0">
        <h2 className="text-sm font-semibold text-[var(--theme-text-primary)] mb-2">
          Agent Event Stream
        </h2>

        {displayedAgentIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {displayedAgentIds.map((agentId) => {
              const baseId = agentId.split(":")[0];
              const hex = getHexColorForApp(baseId);
              const isActive = uniqueAppNames?.includes(agentId) ?? false;
              return (
                <button
                  key={agentId}
                  className={`text-xs px-2 py-0.5 rounded border font-medium transition-opacity ${isActive ? "" : "opacity-50"}`}
                  style={{
                    backgroundColor: hex + "33",
                    borderColor: hex,
                    color: hex,
                  }}
                  onClick={() => onSelectAgent(agentId)}
                >
                  {agentId}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            className={`flex-1 text-xs rounded border bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)] px-2 py-1 outline-none focus:ring-1 focus:ring-[var(--theme-primary)] ${searchError ? "border-red-500" : "border-[var(--theme-border-primary)]"}`}
            placeholder="Search events (regex)..."
            value={searchPattern}
            onChange={(e) => updateSearchPattern(e.target.value)}
          />
          {searchPattern && (
            <button
              className="text-xs px-2 py-1 rounded border border-[var(--theme-border-primary)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-primary)]"
              onClick={clearSearch}
            >
              ✕
            </button>
          )}
        </div>

        {searchError && (
          <p className="text-xs text-red-500 mt-1">{searchError}</p>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 min-h-0"
        onScroll={handleScroll}
      >
        {filteredEvents.map((event) => (
          <EventRow
            key={`${event.id}-${event.timestamp}`}
            event={event}
            gradientClass={getGradientForSession(event.session_id)}
            colorClass={getColorForSession(event.session_id)}
            appColorClass={getColorForApp(event.source_app)}
            appHexColor={getHexColorForApp(event.source_app)}
            onSelectAgent={onSelectAgent}
          />
        ))}

        {filteredEvents.length === 0 && (
          <div className="text-center py-8 text-[var(--theme-text-tertiary)]">
            <div className="text-4xl mb-3">🔳</div>
            <p className="text-lg font-semibold text-[var(--theme-primary)] mb-1">
              No events to display
            </p>
            <p className="text-sm">Events will appear here as they are received</p>
          </div>
        )}
      </div>
    </div>
  );
}
