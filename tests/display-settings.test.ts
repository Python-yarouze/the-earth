import { describe, expect, it } from "vitest";
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  clampDisplaySettings,
  colorTempCssFilter,
  DEFAULT_DISPLAY_SETTINGS,
} from "../src/game/displaySettings";

describe("displaySettings", () => {
  it("clamps brightness and color temperature into range", () => {
    expect(clampDisplaySettings({ brightness: 9, colorTemp: -4 })).toEqual({
      brightness: BRIGHTNESS_MAX,
      colorTemp: -1,
    });
    expect(clampDisplaySettings({ brightness: 0.1, colorTemp: 4 })).toEqual({
      brightness: BRIGHTNESS_MIN,
      colorTemp: 1,
    });
    expect(clampDisplaySettings({})).toEqual(DEFAULT_DISPLAY_SETTINGS);
  });

  it("builds a neutral CSS filter at zero temperature", () => {
    expect(colorTempCssFilter(0)).toBe("none");
  });

  it("builds warm and cool CSS filters", () => {
    expect(colorTempCssFilter(0.5)).toContain("sepia");
    expect(colorTempCssFilter(-0.5)).toContain("hue-rotate");
  });
});
