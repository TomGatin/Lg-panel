import React from 'react'
import ReactDOM from 'react-dom/client'
import { connect } from './lib/live'
import { MjApp } from './mj/MjApp'
import { PublicApp } from './public/PublicApp'
import { RegieApp } from './regie/RegieApp'
import './index.css'

function Home() {
  const links: [string, string, string][] = [
    ['/mj', 'Meneur de jeu', 'Sur le téléphone : scannez le QR code affiché par le serveur.'],
    ['/regie', 'Régie', 'Sur le PC relié aux enceintes et aux lumières.'],
    ['/public', 'Écran public', 'Sur le projecteur. Double-clic pour le plein écran.']
  ]
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-center font-display text-3xl font-bold tracking-[0.08em]">Thiercelieux</h1>
      {links.map(([href, title, hint]) => (
        <a key={href} href={href} className="engraved flex flex-col gap-1 p-5 text-bone no-underline">
          <span className="font-display text-xl font-bold tracking-[0.06em]">{title}</span>
          <span className="font-serif text-base italic text-muted">{hint}</span>
        </a>
      ))}
    </main>
  )
}

const path = location.pathname.replace(/\/+$/, '')
let app: React.ReactNode
if (path === '/mj') {
  connect('mj')
  app = <MjApp />
} else if (path === '/regie') {
  connect('regie')
  app = <RegieApp />
} else if (path === '/public') {
  connect('public')
  app = <PublicApp />
} else {
  app = <Home />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<React.StrictMode>{app}</React.StrictMode>)
