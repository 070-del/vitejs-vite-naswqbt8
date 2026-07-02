# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


V40 color mapping:
- Cチャンネル: 黄色
- ダブルバー: 赤
- シングルバー: 青

## PWA化について

この版はPWA対応済みです。

追加済みファイル：
- public/manifest.webmanifest
- public/sw.js
- public/pwa-192.png
- public/pwa-512.png

変更済みファイル：
- index.html
- src/main.jsx

ローカル確認：
```bash
npm install --registry=https://registry.npmjs.org/
npm run dev
```

本番確認：
PWAとしてホーム画面追加するには、基本的にHTTPS公開が必要です。
Vercelなどに公開してから、スマホのブラウザで「ホーム画面に追加」を行ってください。
