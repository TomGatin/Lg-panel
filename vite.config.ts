import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const socketSyncPlugin = () => {
  return {
    name: 'lg-socket-sync',
    configureServer(server) {
      server.ws.on('lg:play-sound', (data, client) => {
        server.ws.clients.forEach((c) => {
          if (c !== client) {
            c.send('lg:play-sound', data)
          }
        })
      })

      server.ws.on('lg:sync-state', (data, client) => {
        server.ws.clients.forEach((c) => {
          if (c !== client) {
            c.send('lg:sync-state', data)
          }
        })
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), socketSyncPlugin()],
})
