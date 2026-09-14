export interface DisplaySettings {
  /** Fill-light multiplier for ambient / hemisphere / env map (1 = default). */
  brightness: number;
  /** -1 = cool, 0 = neutral, +1 = warm. */
  colorTemp: number;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  brightness: 1,
  colorTemp: 0,
};

export const BRIGHTNESS_MIN = 0.6;
export const BRIGHTNESS_MAX = 1.4;
export const COLOR_TEMP_MIN = -1;
export const COLOR_TEMP_MAX = 1;

const STORAGE_KEY = "the-earth-display-v1";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clampDisplaySettings(partial: Partial<DisplaySettings>): DisplaySettings {
  return {
    brightness: clamp(
      Number.isFinite(partial.brightness) ? Number(partial.brightness) : DEFAULT_DISPLAY_SETTINGS.brightness,
      BRIGHTNESS_MIN,
      BRIGHTNESS_MAX,
    ),
    colorTemp: clamp(
      Number.isFinite(partial.colorTemp) ? Number(partial.colorTemp) : DEFAULT_DISPLAY_SETTINGS.colorTemp,
      COLOR_TEMP_MIN,
      COLOR_TEMP_MAX,
    ),
  };
}

export function loadDisplaySettings(): DisplaySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_DISPLAY_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<DisplaySettings>;
    return clampDisplaySettings(parsed);
  } catch {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
}

export function saveDisplaySettings(settings: DisplaySettings): void {
  const next = clampDisplaySettings(settings);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

/** CSS filter fragment for color temperature (does not include brightness). */
export function colorTempCssFilter(colorTemp: number): string {
  const t = clamp(colorTemp, COLOR_TEMP_MIN, COLOR_TEMP_MAX);
  if (Math.abs(t) < 0.01) {
    return "none";
  }
  if (t > 0) {
    const sepia = (0.28 * t).toFixed(3);
    const saturate = (1 + 0.18 * t).toFixed(3);
    const hue = (-12 * t).toFixed(2);
    return `sepia(${sepia}) saturate(${saturate}) hue-rotate(${hue}deg)`;
  }
  const cool = -t;
  const saturate = (1 + 0.12 * cool).toFixed(3);
  const hue = (28 * cool).toFixed(2);
  const brightness = (1 - 0.04 * cool).toFixed(3);
  return `hue-rotate(${hue}deg) saturate(${saturate}) brightness(${brightness})`;
}
