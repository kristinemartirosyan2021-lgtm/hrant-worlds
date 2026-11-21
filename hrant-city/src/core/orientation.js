// Landscape enforcement ("Rotate your phone") and fullscreen helpers.
const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export function isPortrait() { return isTouch() && window.innerHeight > window.innerWidth; }

export function watchOrientation(onChange) {
  const el = document.getElementById('rotate');
  const check = () => {
    const p = isPortrait();
    el.classList.toggle('hidden', !p);
    onChange && onChange(p);
  };
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', () => setTimeout(check, 200));
  check();
  return check;
}

export function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

export async function toggleFullscreen() {
  const d = document.documentElement;
  try {
    if (isFullscreen()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return true;
    }
    const req = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!req) return false; // iPhone Safari: use "Add to Home Screen" instead
    await req.call(d, { navigationUI: 'hide' });
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    return true;
  } catch { return false; }
}
