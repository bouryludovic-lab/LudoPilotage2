import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Next Step — Pilotage',
  description: 'Plateforme de pilotage factures et clients — The Next Step Consulting',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect x='5' y='5' width='90' height='90' fill='white' stroke='%231a2744' stroke-width='8'/><text x='50' y='62' font-family='Arial' font-size='38' font-weight='900' fill='%231a2744' text-anchor='middle'>TNS</text><circle cx='50' cy='82' r='8' fill='%232e7de9'/></svg>",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: '500',
            },
          }}
          richColors
        />
      </body>
    </html>
  )
}
