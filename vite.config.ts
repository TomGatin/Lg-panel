/// <reference types="vitest" />
import { createLogger, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SERVER = `http://localhost:${process.env.PORT ?? 3000}`

// A phone going to sleep, a heartbeat timeout or a server restart resets the proxied socket:
// the client reconnects on its own, so the stack trace is noise.
const logger = createLogger()
const logError = logger.error
logger.error = (msg, options) => {
  if (msg.includes('ws proxy socket error') && /ECONNRESET|EPIPE/.test(msg)) return
  logError(msg, options)
}

export default defineConfig({
  plugins: [react()],
  customLogger: logger,
  server: {
    proxy: {
      '/ws': { target: SERVER, ws: true },
      '/api': SERVER
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
})
