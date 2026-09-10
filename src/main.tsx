import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router'
import { SpeedInsights } from '@vercel/speed-insights/react'

// Hosted as a single file (Artifact / file://) the app has no server rewrites, so it routes by hash.
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter
import './index.css'
import App from './App'
import { StoreProvider } from './lib/store'
import { UIProvider } from './lib/ui'
import { ThemeProvider } from './lib/theme'
import { ProfileProvider } from './lib/profile'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <ThemeProvider>
      <StoreProvider>
        <UIProvider>
          <ProfileProvider>
            <App />
          </ProfileProvider>
        </UIProvider>
      </StoreProvider>
      </ThemeProvider>
    </Router>
    <SpeedInsights />
  </StrictMode>,
)
