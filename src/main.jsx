import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LoggerProvider } from './context/LoggerContext.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LoggerProvider>
      <App />
    </LoggerProvider>
  </React.StrictMode>
)
