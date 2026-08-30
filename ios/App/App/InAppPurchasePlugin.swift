import Foundation
import Capacitor
import StoreKit

@objc(InAppPurchasePlugin)
class InAppPurchasePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "InAppPurchasePlugin"
    let jsName = "InAppPurchase"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSubscriptionStatus", returnType: CAPPluginReturnPromise),
    ]

    private var updateListenerTask: Task<Void, Never>?

    override func load() {
        updateListenerTask = listenForTransactions()
        printDebugInfo()
    }

    private func printDebugInfo() {
        let bundleId = Bundle.main.bundleIdentifier ?? "unknown"
        print("InAppPurchase [DEBUG]: Bundle ID = \(bundleId)")

        if let receiptURL = Bundle.main.appStoreReceiptURL {
            let isSandbox = receiptURL.lastPathComponent == "sandboxReceipt"
            print("InAppPurchase [DEBUG]: Receipt URL = \(receiptURL)")
            print("InAppPurchase [DEBUG]: Environment = \(isSandbox ? "Sandbox" : "Production/StoreKit")")
        } else {
            print("InAppPurchase [DEBUG]: No receipt URL found")
        }
    }

    deinit {
        updateListenerTask?.cancel()
    }

    private func listenForTransactions() -> Task<Void, Never> {
        Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await transaction.finish()
                    self?.notifyListeners("subscriptionStatusChanged", data: [:])
                }
            }
        }
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        guard let productIds = call.getArray("productIds", String.self) else {
            call.reject("productIds is required")
            return
        }

        Task {
            do {
                let idSet = Set(productIds)
                print("InAppPurchase [DEBUG]: Fetching products for IDs: \(idSet)")
                let products = try await Product.products(for: idSet)
                print("InAppPurchase: Requested IDs: \(productIds), Found \(products.count) products")
                if products.isEmpty {
                    print("InAppPurchase [DEBUG]: 0 products returned. Possible causes:")
                    print("  - Product not configured in App Store Connect")
                    print("  - Bundle ID mismatch (current: \(Bundle.main.bundleIdentifier ?? "nil"))")
                    print("  - Sandbox account not signed in on device")
                    print("  - Product not yet propagated (can take up to 48h)")
                }
                for p in products {
                    print("InAppPurchase [DEBUG]: Product: id=\(p.id), type=\(p.type), price=\(p.price)")
                }
                let result = products.map { product -> [String: Any] in
                    [
                        "id": product.id,
                        "displayName": product.displayName,
                        "description": product.description,
                        "displayPrice": product.displayPrice,
                        "price": "\(product.price)",
                        "type": product.type == .autoRenewable ? "autoRenewable" : "other"
                    ]
                }
                call.resolve(["products": result])
            } catch {
                print("InAppPurchase [ERROR]: Product fetch error: \(error)")
                print("InAppPurchase [ERROR]: Error type: \(type(of: error))")
                print("InAppPurchase [ERROR]: Full description: \(String(describing: error))")
                call.reject("Failed to fetch products: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId is required")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found")
                    return
                }

                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve(["success": true, "productId": transaction.productID])
                    case .unverified(_, let error):
                        call.reject("Transaction verification failed: \(error.localizedDescription)")
                    }
                case .userCancelled:
                    call.resolve(["success": false, "cancelled": true])
                case .pending:
                    call.resolve(["success": false, "pending": true])
                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                let isActive = await self.checkActiveSubscription()
                call.resolve(["restored": isActive])
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func getSubscriptionStatus(_ call: CAPPluginCall) {
        Task {
            let isActive = await self.checkActiveSubscription()
            call.resolve(["isActive": isActive])
        }
    }

    private func checkActiveSubscription() async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                if transaction.productType == .autoRenewable,
                   transaction.revocationDate == nil,
                   let expirationDate = transaction.expirationDate,
                   expirationDate > Date() {
                    return true
                }
            }
        }
        return false
    }
}
