import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { hideSplashScreen, setupStatusBar, isNative } from './native.js'
import { Capacitor } from '@capacitor/core'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if (isNative) {
  Capacitor.ready().then(() => {
    setupStatusBar()
    hideSplashScreen()
  })
} else {
  setupStatusBar()
  hideSplashScreen()

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service Worker registration failed:', error)
      })
    })
  }
}
