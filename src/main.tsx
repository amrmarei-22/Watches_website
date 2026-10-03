import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/i18n'
import './styles/global.css'
import App from './App'
import { AuthProvider } from './context/AuthProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CartProvider } from './hooks/useCart'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element was not found.')
}

const queryClient = new QueryClient()

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></QueryClientProvider>
  </StrictMode>,
)
