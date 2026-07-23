import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { ScopeProvider } from './scope/ScopeContext.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ScopeProvider>
            <BrowserRouter>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  style: {
                    borderRadius: '12px',
                    background: 'rgba(20,20,30,0.9)',
                    color: '#fff',
                    backdropFilter: 'blur(8px)',
                  },
                }}
              />
            </BrowserRouter>
          </ScopeProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
