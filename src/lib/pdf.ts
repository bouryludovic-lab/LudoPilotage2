import type { Invoice, Profil } from './types'
import { DEFAULT_DESIGN } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function fmtDate(d: string): string {
  if (!d) return '—'
  try { return new Intl.DateTimeFormat('fr-FR').format(new Date(d)) } catch { return d }
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

// ─── Logo SVG (same visual style as original MVP) ─────────────────────────────

function buildLogoSvg(nom: string, primary: string, accent: string, tagline: string): string {
  const words    = nom.trim().split(/\s+/)
  const initials = words.slice(0, 3).map(w => w[0]?.toUpperCase() ?? '').join('')
  const label    = esc(nom.toUpperCase())
  const tag      = esc(tagline)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="220" height="68">
  <rect x="2" y="2" width="88" height="88" fill="white" stroke="${primary}" stroke-width="3"/>
  <text x="44" y="52" font-family="Arial,sans-serif" font-size="28" font-weight="900" fill="${primary}" text-anchor="middle">${initials}</text>
  <circle cx="44" cy="72" r="7" fill="${accent}"/>
  <line x1="100" y1="10" x2="100" y2="82" stroke="#e0e0e0" stroke-width="1"/>
  <text x="114" y="42" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="${primary}" letter-spacing="1">${label}</text>
  <line x1="114" y1="52" x2="310" y2="52" stroke="${accent}" stroke-width="2"/>
  <text x="114" y="70" font-family="Arial,sans-serif" font-size="10" font-weight="400" fill="#666" letter-spacing="2">${tag}</text>
</svg>`
}

// ─── HTML invoice builder (matches original MVP design exactly) ───────────────

export function buildInvoiceHTML(invoice: Invoice, profil: Profil): string {
  const design  = { ...DEFAULT_DESIGN, ...(profil.design ?? {}) }
  const PRIMARY = design.primaryColor  // e.g. #1a2744
  const ACCENT  = design.accentColor   // e.g. #2563eb

  // Logo: use uploaded logo image or generate SVG from initials
  const logoHtml = profil.logo
    ? `<img src="${profil.logo}" style="max-height:68px;max-width:220px;object-fit:contain" alt="Logo"/>`
    : buildLogoSvg(profil.nom || 'LP', PRIMARY, ACCENT, design.tagline)

  // Line items
  const lignes = Array.isArray(invoice.lignes) ? invoice.lignes : []
  const rows = lignes.length > 0
    ? lignes.map(l => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #eef2f7;font-size:13px">${esc(l.desc)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #eef2f7;font-size:13px;text-align:center">${l.qte}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #eef2f7;font-size:13px;text-align:right">${fmtMoney(l.pu)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #eef2f7;font-size:13px;text-align:right;font-weight:700">${fmtMoney(l.qte * l.pu)}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" style="padding:16px;text-align:center;color:#aaa;font-size:13px">Aucune prestation renseignée</td></tr>`

  // Bank details from design config
  const bankName    = design.bankName    || ''
  const bankBicIban = [
    design.bic   ? `BIC : ${esc(design.bic)}`      : '',
    profil.iban  ? `IBAN : ${esc(profil.iban)}`    : '',
  ].filter(Boolean).join(' &nbsp;|&nbsp; ')
  const bankHolder  = design.titulaire   ? `Titulaire : ${esc(design.titulaire)}`  : ''
  const bankDetails = design.bankDetails ? esc(design.bankDetails) : ''

  const bankLines = [bankName ? esc(bankName) : '', bankBicIban, bankHolder, bankDetails]
    .filter(Boolean).join('<br>')

  return `
<div id="invoice-root" style="background:white;font-family:Arial,Helvetica,sans-serif;padding:0;width:700px">
<div style="padding:36px 44px">

  <!-- Header: logo + FACTURE block -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px">
    <div>${logoHtml}</div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:700;color:${PRIMARY};letter-spacing:.5px;text-transform:uppercase">FACTURE</div>
      <div style="font-size:14px;font-weight:600;color:${ACCENT};margin-top:4px">N° ${esc(invoice.num)}</div>
      <div style="font-size:11px;color:#888;margin-top:6px">Émise le ${fmtDate(invoice.date)}</div>
      <div style="font-size:11px;color:#888">Échéance : ${esc(invoice.echeanceLabel || fmtDate(invoice.echeance))}</div>
      <div style="font-size:11px;color:#888">Règlement : ${esc(invoice.paiement)}</div>
    </div>
  </div>

  <!-- From / To -->
  <div style="display:flex;gap:32px;margin-bottom:32px">
    <div style="flex:1">
      <div style="font-size:10px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px">De</div>
      <div style="font-weight:700;font-size:14px;color:${PRIMARY}">${esc(profil.nom || '—')}</div>
      <div style="font-size:12px;color:#555;line-height:1.7">${esc(profil.adresse || '')}</div>
      <div style="font-size:12px;color:#555">${esc(profil.email || '')}${profil.tel ? ' &nbsp;·&nbsp; ' + esc(profil.tel) : ''}</div>
      ${profil.siret ? `<div style="font-size:11px;color:#aaa;margin-top:3px">SIRET : ${esc(profil.siret)}</div>` : ''}
    </div>
    <div style="flex:1">
      <div style="font-size:10px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px">Facturé à</div>
      <div style="font-weight:700;font-size:14px;color:${PRIMARY}">${esc(invoice.clientNom || '—')}</div>
      <div style="font-size:12px;color:#555;line-height:1.7">${esc(invoice.clientAdresse || '')}</div>
      ${invoice.clientEmail ? `<div style="font-size:12px;color:#555">${esc(invoice.clientEmail)}</div>` : ''}
      ${invoice.clientSiret ? `<div style="font-size:11px;color:#aaa;margin-top:3px">SIRET : ${esc(invoice.clientSiret)}</div>` : ''}
    </div>
  </div>

  <!-- Prestations table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead>
      <tr style="background:#e8e8e8;border-bottom:2px solid ${PRIMARY}">
        <th style="padding:10px 16px;text-align:left;font-size:11px;color:${PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:.5px">Prestation</th>
        <th style="padding:10px 16px;text-align:center;font-size:11px;color:${PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:.5px">Qté</th>
        <th style="padding:10px 16px;text-align:right;font-size:11px;color:${PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:.5px">P.U. HT</th>
        <th style="padding:10px 16px;text-align:right;font-size:11px;color:${PRIMARY};font-weight:700;text-transform:uppercase;letter-spacing:.5px">Total HT</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:36px">
    <div style="min-width:260px">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#888;border-bottom:1px solid #eee">
        <span>Sous-total HT</span>
        <span style="font-weight:600;color:#333">${fmtMoney(invoice.total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:11px;color:#bbb">
        <span>TVA</span>
        <span>Non applicable — art. 293 B CGI</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 16px;font-size:16px;font-weight:700;background:${PRIMARY};color:white;border-radius:8px;margin-top:8px">
        <span>Total à payer</span>
        <span style="color:#5dd4f0">${fmtMoney(invoice.total)}</span>
      </div>
    </div>
  </div>

  <!-- Bank details -->
  <div style="border-top:2px solid ${PRIMARY};padding-top:20px">
    <div style="font-size:11px;font-weight:700;color:${PRIMARY};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px">Coordonnées bancaires</div>
    ${bankLines
      ? `<div style="font-size:12px;color:#444;line-height:1.8">${bankLines}</div>`
      : `<div style="font-size:12px;color:#aaa">IBAN non configuré — rendez-vous dans Modèle facture</div>`
    }
    <div style="font-size:12px;font-weight:700;color:${PRIMARY};margin-top:10px">${esc(invoice.paiement)}</div>
    ${invoice.notes ? `<div style="font-size:12px;color:#555;margin-top:10px;padding:10px;background:#f8f8f8;border-radius:6px">${esc(invoice.notes)}</div>` : ''}
    <div style="font-size:10px;color:#ccc;margin-top:14px">TVA non applicable, article 293 B du CGI — Micro-entrepreneur</div>
  </div>

</div>
</div>`
}

// ─── PDF generation via jsPDF html() + html2canvas ───────────────────────────

export async function generateInvoicePdf(invoice: Invoice, profil: Profil): Promise<string> {
  const html = buildInvoiceHTML(invoice, profil)

  // Mount hidden element (must be in DOM for html2canvas)
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;z-index:-1'
  wrapper.innerHTML     = html
  document.body.appendChild(wrapper)

  try {
    const { jsPDF } = await import('jspdf')
    await import('html2canvas') // ensure loaded for jsPDF html plugin

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const el  = wrapper.firstElementChild as HTMLElement

    await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(doc as any).html(el, {
        callback:    (pdf: typeof doc) => { void pdf; resolve() },
        x:           0,
        y:           0,
        width:       595,       // A4 width in pt
        windowWidth: 794,       // element pixel width → scale to A4
        margin:      0,
        autoPaging:  'text',
        html2canvas: {
          scale:       1.5,
          useCORS:     true,
          allowTaint:  true,
          logging:     false,
        },
      })
    })

    return doc.output('datauristring')
  } finally {
    document.body.removeChild(wrapper)
  }
}

// ─── Base64 variant (for GitHub upload) ──────────────────────────────────────

export async function generatePdfBase64(invoice: Invoice, profil: Profil): Promise<string> {
  const uri = await generateInvoicePdf(invoice, profil)
  return uri.split('base64,')[1] ?? ''
}
