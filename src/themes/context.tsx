import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BUILTIN_THEMES, defaultTheme } from "./presets";
import {
  FONT_CHOICES,
  THEME_DEFAULT_FONT_ID,
  getFontChoice,
  type FontChoice,
} from "./fonts";
import type {
  DashboardTheme,
  ThemeAssets,
  ThemeColorOverrides,
  ThemeComponentStyles,
  ThemeDensity,
  ThemeLayer,
  ThemeLayout,
  ThemeLayoutVariant,
  ThemeListEntry,
  ThemePalette,
  ThemeSeriesColors,
  ThemeTypography,
} from "./types";
import { api } from "@/lib/api";

/** LocalStorage key — pre-applied before the React tree mounts to avoid
 *  a visible flash of the default palette on theme-overridden installs. */
const STORAGE_KEY = "hermes-dashboard-theme";

/** LocalStorage key for the font override (independent of theme). Holds a
 *  font id from the catalog in `fonts.ts`, or the `THEME_DEFAULT_FONT_ID`
 *  sentinel / absent = "use the active theme's font". Pre-applied before
 *  the React tree mounts (see `main.tsx`) to avoid a font flash. */
const FONT_STORAGE_KEY = "hermes-dashboard-font";

/** Renames of built-in theme keys we've shipped previously. */
const THEME_NAME_ALIASES: Record<string, string> = {
  "lens-5i": "nous-blue",
};

function migrateThemeName(name: string): string {
  return THEME_NAME_ALIASES[name] ?? name;
}

/** Tracks fontUrls we've already injected. */
const INJECTED_FONT_URLS = new Set<string>();

// ---------------------------------------------------------------------------
// CSS variable builders
// ---------------------------------------------------------------------------

function layerVars(
  name: "background" | "midground" | "foreground",
  layer: ThemeLayer,
): Record<string, string> {
  const pct = Math.round(layer.alpha * 100);
  return {
    [`--${name}`]: `color-mix(in srgb, ${layer.hex} ${pct}%, transparent)`,
    [`--${name}-base`]: layer.hex,
    [`--${name}-alpha`]: String(layer.alpha),
  };
}

function paletteVars(palette: ThemePalette): Record<string, string> {
  return {
    ...layerVars("background", palette.background),
    ...layerVars("midground", palette.midground),
    ...layerVars("foreground", palette.foreground),
    "--warm-glow": palette.warmGlow,
    "--noise-opacity-mul": String(palette.noiseOpacity),
  };
}

const DENSITY_MULTIPLIERS: Record<ThemeDensity, string> = {
  compact: "0.85",
  comfortable: "1",
  spacious: "1.2",
};

function typographyVars(typo: ThemeTypography): Record<string, string> {
  return {
    "--theme-font-sans": typo.fontSans,
    "--theme-font-mono": typo.fontMono,
    "--theme-font-display": typo.fontDisplay ?? typo.fontSans,
    "--theme-base-size": typo.baseSize,
    "--theme-line-height": typo.lineHeight,
    "--theme-letter-spacing": typo.letterSpacing,
  };
}

function layoutVars(layout: ThemeLayout): Record<string, string> {
  return {
    "--radius": layout.radius,
    "--theme-radius": layout.radius,
    "--theme-spacing-mul": DENSITY_MULTIPLIERS[layout.density] ?? "1",
    "--theme-density": layout.density,
  };
}

/** Map a color-overrides key (camelCase) to its `--color-*` CSS var. */
const OVERRIDE_KEY_TO_VAR: Record<keyof ThemeColorOverrides, string> = {
  card: "--color-card",
  cardForeground: "--color-card-foreground",
  popover: "--color-popover",
  popoverForeground: "--color-popover-foreground",
  primary: "--color-primary",
  primaryForeground: "--color-primary-foreground",
  secondary: "--color-secondary",
  secondaryForeground: "--color-secondary-foreground",
  muted: "--color-muted",
  mutedForeground: "--color-muted-foreground",
  accent: "--color-accent",
  accentForeground: "--color-accent-foreground",
  destructive: "--color-destructive",
  destructiveForeground: "--color-destructive-foreground",
  success: "--color-success",
  warning: "--color-warning",
  border: "--color-border",
  input: "--color-input",
  ring: "--color-ring",
};

const ALL_OVERRIDE_VARS = Object.values(OVERRIDE_KEY_TO_VAR);

function overrideVars(
  overrides: ThemeColorOverrides | undefined,
): Record<string, string> {
  if (!overrides) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!value) continue;
    const cssVar = OVERRIDE_KEY_TO_VAR[key as keyof ThemeColorOverrides];
    if (cssVar) out[cssVar] = value;
  }
  return out;
}

const SERIES_KEY_TO_VAR: Record<keyof ThemeSeriesColors, string> = {
  inputTokenAccent: "--series-input-token",
  outputTokenAccent: "--series-output-token",
};

const ALL_SERIES_VARS = Object.values(SERIES_KEY_TO_VAR);

function seriesColorVars(
  series: ThemeSeriesColors | undefined,
): Record<string, string> {
  if (!series) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(series)) {
    if (!value) continue;
    const cssVar = SERIES_KEY_TO_VAR[key as keyof ThemeSeriesColors];
    if (cssVar) out[cssVar] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Asset + component-style + layout variant vars
// ---------------------------------------------------------------------------

const NAMED_ASSET_KEYS = ["bg", "hero", "logo", "crest", "sidebar", "header"] as const;
const COMPONENT_BUCKETS = [
  "card", "header", "footer", "sidebar", "tab",
  "progress", "badge", "backdrop", "page",
] as const;

function toKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function assetVars(assets: ThemeAssets | undefined): Record<string, string> {
  if (!assets) return {};
  const out: Record<string, string> = {};
  const wrap = (v: string): string => {
    const trimmed = v.trim();
    if (!trimmed) return "";
    if (/^(url\(|linear-gradient|radial-gradient|conic-gradient|none$)/i.test(trimmed)) {
      return trimmed;
    }
    return `url("${trimmed.replace(/"/g, '\\"')}")`;
  };
  for (const key of NAMED_ASSET_KEYS) {
    const val = assets[key];
    if (typeof val === "string" && val.trim()) {
      out[`--theme-asset-${key}`] = wrap(val);
      out[`--theme-asset-${key}-raw`] = val;
    }
  }
  if (assets.custom) {
    for (const [key, val] of Object.entries(assets.custom)) {
      if (typeof val !== "string" || !val.trim()) continue;
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) continue;
      out[`--theme-asset-custom-${key}`] = wrap(val);
      out[`--theme-asset-custom-${key}-raw`] = val;
    }
  }
  return out;
}

function componentStyleVars(
  styles: ThemeComponentStyles | undefined,
): Record<string, string> {
  if (!styles) return {};
  const out: Record<string, string> = {};
  for (const bucket of COMPONENT_BUCKETS) {
    const props = (styles as Record<string, Record<string, string> | undefined>)[bucket];
    if (!props) continue;
    for (const [prop, value] of Object.entries(props)) {
      if (typeof value !== "string" || !value.trim()) continue;
      if (!/^[a-zA-Z0-9_-]+$/.test(prop)) continue;
      out[`--component-${bucket}-${toKebab(prop)}`] = value;
    }
  }
  return out;
}

let _PREV_DYNAMIC_VAR_KEYS: Set<string> = new Set();
const CUSTOM_CSS_STYLE_ID = "hermes-theme-custom-css";

function applyCustomCSS(css: string | undefined) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(CUSTOM_CSS_STYLE_ID) as HTMLStyleElement | null;
  if (!css || !css.trim()) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("style");
    el.id = CUSTOM_CSS_STYLE_ID;
    el.setAttribute("data-hermes-theme-css", "true");
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function applyLayoutVariant(variant: ThemeLayoutVariant | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const final: ThemeLayoutVariant = variant ?? "standard";
  root.dataset.layoutVariant = final;
  root.style.setProperty("--theme-layout-variant", final);
}

// ---------------------------------------------------------------------------
// Font stylesheet injection
// ---------------------------------------------------------------------------

function injectFontStylesheet(url: string | undefined) {
  if (!url || typeof document === "undefined") return;
  if (INJECTED_FONT_URLS.has(url)) return;
  const existing = document.querySelector<HTMLLinkElement>(
    `link[rel="stylesheet"][href="${CSS.escape(url)}"]`,
  );
  if (existing) {
    INJECTED_FONT_URLS.add(url);
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.setAttribute("data-hermes-theme-font", "true");
  document.head.appendChild(link);
  INJECTED_FONT_URLS.add(url);
}

// ---------------------------------------------------------------------------
// Font override (independent of theme)
// ---------------------------------------------------------------------------

let _ACTIVE_FONT_OVERRIDE: string = THEME_DEFAULT_FONT_ID;

function applyFontOverride(fontId: string | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const choice: FontChoice | undefined = getFontChoice(fontId);
  if (!choice) {
    root.style.removeProperty("--theme-font-override-sans");
    return;
  }
  injectFontStylesheet(choice.fontUrl);
  root.style.setProperty("--theme-font-override-sans", choice.stack);
  root.style.setProperty("--theme-font-sans", choice.stack);
  root.style.setProperty("--theme-font-display", choice.stack);
}

// ---------------------------------------------------------------------------
// Apply a full theme to :root
// ---------------------------------------------------------------------------

function applyTheme(theme: DashboardTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  for (const cssVar of ALL_OVERRIDE_VARS) {
    root.style.removeProperty(cssVar);
  }
  for (const cssVar of ALL_SERIES_VARS) {
    root.style.removeProperty(cssVar);
  }
  for (const prevKey of _PREV_DYNAMIC_VAR_KEYS) {
    root.style.removeProperty(prevKey);
  }

  const assetMap = assetVars(theme.assets);
  const componentMap = componentStyleVars(theme.componentStyles);
  _PREV_DYNAMIC_VAR_KEYS = new Set([
    ...Object.keys(assetMap),
    ...Object.keys(componentMap),
  ]);

  const vars = {
    ...paletteVars(theme.palette),
    ...typographyVars(theme.typography),
    ...layoutVars(theme.layout),
    ...overrideVars(theme.colorOverrides),
    ...seriesColorVars(theme.seriesColors),
    ...assetMap,
    ...componentMap,
  };
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }

  injectFontStylesheet(theme.typography.fontUrl);
  applyCustomCSS(theme.customCSS);
  applyLayoutVariant(theme.layoutVariant);

  root.style.setProperty(
    "--theme-terminal-background",
    theme.terminalBackground ?? "#000000",
  );

  applyFontOverride(_ACTIVE_FONT_OVERRIDE);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<string>(() => {
    if (typeof window === "undefined") return "default";
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? "default";
    const migrated = migrateThemeName(stored);
    if (migrated !== stored) {
      window.localStorage.setItem(STORAGE_KEY, migrated);
    }
    return migrated;
  });

  const [availableThemes, setAvailableThemes] = useState<ThemeListEntry[]>(() =>
    Object.values(BUILTIN_THEMES).map((t) => ({
      name: t.name,
      label: t.label,
      description: t.description,
    })),
  );

  const [userThemeDefs, setUserThemeDefs] = useState<
    Record<string, DashboardTheme>
  >({});

  const [fontId, setFontId] = useState<string>(() => {
    if (typeof window === "undefined") return THEME_DEFAULT_FONT_ID;
    const stored = window.localStorage.getItem(FONT_STORAGE_KEY);
    const valid = stored && getFontChoice(stored) ? stored : THEME_DEFAULT_FONT_ID;
    _ACTIVE_FONT_OVERRIDE = valid;
    return valid;
  });

  const resolveTheme = useCallback(
    (name: string): DashboardTheme => {
      return (
        BUILTIN_THEMES[name] ??
        userThemeDefs[name] ??
        defaultTheme
      );
    },
    [userThemeDefs],
  );

  useEffect(() => {
    _ACTIVE_FONT_OVERRIDE = fontId;
    applyTheme(resolveTheme(themeName));
  }, [themeName, resolveTheme, fontId]);

  useEffect(() => {
    let cancelled = false;
    api
      .getThemes()
      .then((resp) => {
        if (cancelled) return;
        if (resp.themes?.length) {
          setAvailableThemes(
            resp.themes.map((t) => ({
              name: t.name,
              label: t.label,
              description: t.description,
              definition: t.definition,
            })),
          );
          const defs: Record<string, DashboardTheme> = {};
          for (const entry of resp.themes) {
            if (entry.definition) {
              defs[entry.name] = entry.definition;
            }
          }
          if (Object.keys(defs).length > 0) setUserThemeDefs(defs);
        }
        if (resp.active) {
          const migratedActive = migrateThemeName(resp.active);
          if (migratedActive !== themeName) {
            setThemeName(migratedActive);
            window.localStorage.setItem(STORAGE_KEY, migratedActive);
          }
          if (migratedActive !== resp.active) {
            api.setTheme(migratedActive).catch(() => {});
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getFontPref()
      .then((resp) => {
        if (cancelled) return;
        const serverId =
          resp?.font && getFontChoice(resp.font) ? resp.font : THEME_DEFAULT_FONT_ID;
        if (serverId !== fontId) {
          setFontId(serverId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(FONT_STORAGE_KEY, serverId);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback(
    (name: string) => {
      const knownNames = new Set<string>([
        ...Object.keys(BUILTIN_THEMES),
        ...availableThemes.map((t) => t.name),
        ...Object.keys(userThemeDefs),
      ]);
      const next = knownNames.has(name) ? name : "default";
      setThemeName(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
      api.setTheme(next).catch(() => {});
    },
    [availableThemes, userThemeDefs],
  );

  const setFont = useCallback((id: string) => {
    const next = getFontChoice(id) ? id : THEME_DEFAULT_FONT_ID;
    setFontId(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FONT_STORAGE_KEY, next);
    }
    api.setFontPref(next).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: resolveTheme(themeName),
      themeName,
      availableThemes,
      setTheme,
      fontId,
      fontChoices: FONT_CHOICES,
      setFont,
    }),
    [themeName, availableThemes, setTheme, resolveTheme, fontId, setFont],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  themeName: "default",
  availableThemes: Object.values(BUILTIN_THEMES).map((t) => ({
    name: t.name,
    label: t.label,
    description: t.description,
  })),
  setTheme: () => {},
  fontId: THEME_DEFAULT_FONT_ID,
  fontChoices: FONT_CHOICES,
  setFont: () => {},
});

interface ThemeContextValue {
  availableThemes: ThemeListEntry[];
  setTheme: (name: string) => void;
  theme: DashboardTheme;
  themeName: string;
  fontId: string;
  fontChoices: FontChoice[];
  setFont: (id: string) => void;
}
