// localStorage persistence for progress and settings (all wrapped: storage may be blocked).
const SAVE_KEY = 'hrantcity_save_v1';
const SET_KEY = 'hrantcity_settings_v1';

function read(key) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } }
function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; } }

export function defaultQuality() {
  const touch = matchMedia('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory || 4;
  if (touch) return mem <= 3 ? 'low' : 'medium';
  return 'high';
}

export function loadSettings() {
  return { quality: defaultQuality(), volume: 0.8, music: 0.5, sensitivity: 1, showFps: false, ...(read(SET_KEY) || {}) };
}
export const saveSettings = (s) => write(SET_KEY, s);
export const loadSave = () => read(SAVE_KEY);
export const writeSave = (d) => write(SAVE_KEY, { ...d, savedAt: Date.now(), v: 1 });
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
