# Codemagic setup

This project uses `codemagic.yaml` to build the iOS app and upload a signed IPA to App Store Connect.

## Codemagic app setup

1. Add this GitHub repository to Codemagic.
2. In Codemagic, scan the `main` branch for `codemagic.yaml`.
3. Create an environment variable group named `appstore_credentials`.
4. Add these variables to the `appstore_credentials` group and mark them as secret:
   - `APP_STORE_CONNECT_PRIVATE_KEY`: contents of the App Store Connect `.p8` API key
   - `APP_STORE_CONNECT_KEY_IDENTIFIER`: App Store Connect API Key ID
   - `APP_STORE_CONNECT_ISSUER_ID`: App Store Connect Issuer ID
5. In Codemagic code signing identities, make sure an App Store distribution certificate and provisioning profile are available for `com.keiten.hiroihashi`.

## Workflow

Run the `iOS App Store build` workflow.

The workflow installs dependencies, builds the Vite app, syncs Capacitor iOS files, increments the iOS build number above the current local build `20`, signs the app, creates the IPA, and uploads it to App Store Connect.

The workflow does not automatically submit the uploaded build to TestFlight or App Store review. Submit the build manually after confirming the App Store metadata no longer mentions subscriptions.
