import { Capacitor, registerPlugin } from "@capacitor/core";

const InAppPurchase = registerPlugin("InAppPurchase");
const isNative = Capacitor.isNativePlatform();

const PRODUCT_ID = "com.keiten.hiroihashi.monthly";

export async function checkSubscription() {
  if (!isNative) return true;
  try {
    const { isActive } = await InAppPurchase.getSubscriptionStatus();
    return isActive;
  } catch (e) {
    console.error("Subscription check failed:", e);
    return false;
  }
}

export async function getSubscriptionProduct() {
  if (!isNative) return null;
  try {
    const { products } = await InAppPurchase.getProducts({
      productIds: [PRODUCT_ID],
    });
    return products?.[0] || null;
  } catch (e) {
    console.error("Get products failed:", e);
    return null;
  }
}

export async function purchaseSubscription() {
  if (!isNative) return { success: false };
  try {
    const result = await InAppPurchase.purchase({ productId: PRODUCT_ID });
    return result;
  } catch (e) {
    console.error("Purchase failed:", e);
    const msg = e?.errorMessage || e?.message || "購入に失敗しました";
    return { success: false, error: msg };
  }
}

export async function restorePurchases() {
  if (!isNative) return true;
  try {
    const { restored } = await InAppPurchase.restorePurchases();
    return restored;
  } catch (e) {
    console.error("Restore failed:", e);
    return false;
  }
}

export function addSubscriptionListener(callback) {
  if (!isNative) return { remove: () => {} };
  return InAppPurchase.addListener("subscriptionStatusChanged", callback);
}

export { PRODUCT_ID };
