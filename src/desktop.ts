/** Desktop (Electron) bridge — undefined on the web build. */
export interface TheEarthDesktopBridge {
  isDesktop: true;
  enterWallpaper: () => Promise<{ ok: boolean; error?: string; mode?: string }>;
  exitWallpaper: () => Promise<{ ok: boolean; error?: string }>;
  getWallpaperActive: () => Promise<boolean>;
  onWallpaperChanged: (handler: (active: boolean) => void) => () => void;
}

declare global {
  interface Window {
    theEarthDesktop?: TheEarthDesktopBridge;
  }
}

export function isDesktopApp(): boolean {
  return Boolean(window.theEarthDesktop?.isDesktop);
}

export {};
