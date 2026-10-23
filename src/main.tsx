import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { installApiSessionBridge } from '@/lib/api/bootstrap'
import '@/index.css'

// Wired up before the first render so no request can go out unauthenticated.
installApiSessionBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
