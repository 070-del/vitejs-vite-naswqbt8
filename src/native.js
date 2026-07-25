import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Share } from "@capacitor/share";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Preferences } from "@capacitor/preferences";

const isNative = Capacitor.isNativePlatform();

export async function hideSplashScreen() {
  if (!isNative) return;
  await SplashScreen.hide({ fadeOutDuration: 300 });
}

export async function setupStatusBar() {
  if (!isNative) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.show();
  } catch (e) {
    console.warn("StatusBar setup failed:", e);
  }
}

export async function tapHaptic() {
  if (!isNative) return;
  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function successHaptic() {
  if (!isNative) return;
  await Haptics.notification({ type: NotificationType.Success });
}

export async function warningHaptic() {
  if (!isNative) return;
  await Haptics.notification({ type: NotificationType.Warning });
}

export async function shareResults(title, text) {
  if (!isNative) {
    if (navigator.share) {
      await navigator.share({ title, text });
    }
    return;
  }
  await Share.share({ title, text, dialogTitle: "結果を共有" });
}

export async function saveToNativeStorage(key, value) {
  if (!isNative) {
    localStorage.setItem(key, value);
    return;
  }
  await Preferences.set({ key, value });
}

export async function loadFromNativeStorage(key) {
  if (!isNative) {
    return localStorage.getItem(key);
  }
  const { value } = await Preferences.get({ key });
  return value;
}

export async function removeFromNativeStorage(key) {
  if (!isNative) {
    localStorage.removeItem(key);
    return;
  }
  await Preferences.remove({ key });
}

export async function getAllNativeStorageKeys() {
  if (!isNative) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i));
    }
    return keys;
  }
  const { keys } = await Preferences.keys();
  return keys;
}

export { isNative };
