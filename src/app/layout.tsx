import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'LudoPilotage — SaaS IA',
  description: 'Plateforme SaaS pilotée par l\'IA — Facturation, HUB, Coaching',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%237C3AED'/><stop offset='100%25' stop-color='%234F46E5'/></linearGradient></defs><rect width='100' height='100' rx='22' fill='url(%23g)'/><text x='50' y='66' font-family='Inter,Arial' font-size='46' font-weight='800' fill='white' text-anchor='middle'>LP</text></svg>",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body style={{ background: '#080B14' }}>
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: '500',
              background: '#1A2235',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.9)',
            },
          }}
          richColors
        />
      </body>
    </html>
  )
}
