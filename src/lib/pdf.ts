import type { Invoice, Profil, InvoiceDesign } from './types'
import { DEFAULT_DESIGN } from './types'
import { formatEur, formatDate } from './utils'

// ─── jsPDF dynamic import (avoids SSR issues) ─────────────────────────────────
async function getJsPDF() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}

type Doc = InstanceType<Awaited<ReturnType<typeof getJsPDF>>>

// ─── Hex → [R,G,B] ───────────────────────────────────────────────────────────
function hex(h: string): [number, number, number] {
  const s = h.replace('#', '')
  const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Darken a hex color by a fraction (0–1)
function darken(h: string, amount = 0.2): [number, number, number] {
  const [r, g, b] = hex(h)
  return [Math.round(r * (1 - amount)), Math.round(g * (1 - amount)), Math.round(b * (1 - amount))]
}

// ─── Neutral palette (doesn't change with design) ────────────────────────────
const N = {
  slate900:  [15,  23,  42]  as [number, number, number],
  slate700:  [51,  65,  85]  as [number, number, number],
  slate500:  [100, 116, 139] as [number, number, number],
  slate300:  [203, 213, 225] as [number, number, number],
  slate100:  [241, 245, 249] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────
function fillRect(doc: Doc, x: number, y: number, w: number, h: number, color: [number, number, number]) {
  doc.setFillColor(...color)
  doc.rect(x, y, w, h, 'F')
}

function txt(doc: Doc, str: string, x: number, y: number, opts?: {
  size?:  number
  color?: [number, number, number]
  bold?:  boolean
  align?: 'left' | 'right' | 'center'
}) {
  if (!str) return
  doc.setFontSize(opts?.size ?? 9)
  doc.setTextColor(...(opts?.color ?? N.slate700))
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  doc.text(str, x, y, { align: opts?.align ?? 'left' })
}

function hline(doc: Doc, x1: number, y: number, x2: number, color: [number, number, number], lw = 0.3) {
  doc.setDrawColor(...color)
  doc.setLineWidth(lw)
  doc.line(x1, y, x2, y)
}

// ─── Main generator ───────────────────────────────────────────────────────────
export async function generateInvoicePdf(invoice: Invoice, profil: Profil): Promise<string> {
  const JsPDF = await getJsPDF()
  const doc   = new JsPDF({ unit: 'mm', format: 'a4' })

  const d: InvoiceDesign = { ...DEFAULT_DESIGN, ...(profil.design ?? {}) }
  const PRIMARY = hex(d.primaryColor)
  const ACCENT  = hex(d.accentColor)
  const ACCENT_D = darken(d.accentColor, 0.15)

  const PW = 210
  const M  = 15

  // ══════════════════════════════════════════════════════════════════════════
  // 1. HEADER BAND
  // ══════════════════════════════════════════════════════════════════════════
  fillRect(doc, 0, 0, PW, 42, PRIMARY)

  // Logo or text fallback
  if (profil.logo) {
    try {
      const ext = profil.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(profil.logo, ext, M, 8, 26, 26)
    } catch {}
  } else {
    // Square logo placeholder with accent color
    fillRect(doc, M, 8, 28, 26, ACCENT)
    const initials = (profil.nom || 'TNS').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
    txt(doc, initials, M + 14, 23.5, { size: 12, color: N.white, bold: true, align: 'center' })
  }

  // Company name + tagline
  const textX = M + 34
  txt(doc, (profil.nom || '').toUpperCase(), textX, 18, { size: 13, color: N.white, bold: true })
  txt(doc, d.tagline, textX, 24.5, { size: 7.5, color: [148, 163, 184] })
  if (profil.siret) {
    txt(doc, `SIRET ${profil.siret}`, textX, 30, { size: 7, color: [100, 116, 139] })
  }

  // Invoice badge (top-right)
  fillRect(doc, PW - M - 48, 10, 48, 22, ACCENT)
  txt(doc, 'FACTURE', PW - M - 24, 19, { size: 9, color: N.white, bold: true, align: 'center' })
  txt(doc, invoice.num, PW - M - 24, 26, { size: 9.5, color: N.white, bold: true, align: 'center' })

  // ══════════════════════════════════════════════════════════════════════════
  // 2. DATE / ECHÉANCE / PAIEMENT ROW
  // ══════════════════════════════════════════════════════════════════════════
  fillRect(doc, 0, 42, PW, 11, N.slate100)
  txt(doc, `Date d'émission : ${formatDate(invoice.date)}`,        M,        48, { size: 8, color: N.slate700 })
  txt(doc, `Échéance : ${invoice.echeanceLabel || '30 jours'}`,   PW / 2,   48, { size: 8, color: N.slate700, align: 'center' })
  txt(doc, `Paiement : ${invoice.paiement}`,                      PW - M,   48, { size: 8, color: N.slate700, align: 'right' })

  // ══════════════════════════════════════════════════════════════════════════
  // 3. ADDRESSES  (DE / À)
  // ══════════════════════════════════════════════════════════════════════════
  let y = 62

  // — Emetteur (left) ———————————————————————————————————————————————————————
  txt(doc, 'DE', M, y, { size: 7, color: N.slate500, bold: true })
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.5)
  doc.line(M + 8, y - 0.5, M + 24, y - 0.5)
  y += 5

  txt(doc, profil.nom || '', M, y, { size: 9.5, color: N.slate900, bold: true })
  y += 5.5

  if (profil.adresse) {
    const lines = profil.adresse.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    for (const l of lines) { txt(doc, l, M, y, { size: 8, color: N.slate700 }); y += 4.5 }
  }
  if (profil.email) { txt(doc, profil.email, M, y, { size: 8, color: N.slate700 }); y += 4.5 }
  if (profil.tel)   { txt(doc, profil.tel,   M, y, { size: 8, color: N.slate700 }); y += 4.5 }
  if (profil.siret) { txt(doc, `SIRET : ${profil.siret}`, M, y, { size: 8, color: N.slate500 }) }

  // — Destinataire (right) ——————————————————————————————————————————————————
  let yr = 62
  const rx = PW / 2 + 5

  txt(doc, 'FACTURÉ À', rx, yr, { size: 7, color: N.slate500, bold: true })
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.5)
  doc.line(rx, yr + 1, PW - M, yr + 1)
  yr += 5

  txt(doc, invoice.clientNom, rx, yr, { size: 9.5, color: N.slate900, bold: true })
  yr += 5.5

  if (invoice.clientAdresse) {
    const lines = invoice.clientAdresse.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    for (const l of lines) { txt(doc, l, rx, yr, { size: 8, color: N.slate700 }); yr += 4.5 }
  }
  if (invoice.clientSiret) { txt(doc, `SIRET : ${invoice.clientSiret}`, rx, yr, { size: 8, color: N.slate500 }); yr += 4.5 }
  if (invoice.clientEmail) { txt(doc, invoice.clientEmail, rx, yr, { size: 8, color: N.slate700 }) }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. LINE ITEMS TABLE
  // ══════════════════════════════════════════════════════════════════════════
  y = Math.max(y, yr) + 12

  const COL = { desc: M, qte: 122, pu: 150, tot: PW - M - 2 }

  // Table header
  fillRect(doc, M, y, PW - 2 * M, 8, PRIMARY)
  txt(doc, 'PRESTATION',     COL.desc + 3, y + 5.2, { size: 7.5, color: N.white, bold: true })
  txt(doc, 'QTÉ',            COL.qte,      y + 5.2, { size: 7.5, color: N.white, bold: true, align: 'center' })
  txt(doc, 'P.U. HT',        COL.pu,       y + 5.2, { size: 7.5, color: N.white, bold: true, align: 'right' })
  txt(doc, 'TOTAL HT',       COL.tot,      y + 5.2, { size: 7.5, color: N.white, bold: true, align: 'right' })
  y += 8

  // Line rows
  const lignes = Array.isArray(invoice.lignes) ? invoice.lignes : []
  if (lignes.length === 0) {
    // Graceful fallback if no lines
    fillRect(doc, M, y, PW - 2 * M, 8, N.white)
    txt(doc, '(aucune prestation)', COL.desc + 3, y + 5.2, { size: 8, color: N.slate500 })
    y += 8
  } else {
    for (let i = 0; i < lignes.length; i++) {
      const ligne  = lignes[i]
      const rowH   = 9
      const bg     = i % 2 === 0 ? N.white : N.slate100
      fillRect(doc, M, y, PW - 2 * M, rowH, bg)
      hline(doc, M, y + rowH, PW - M, N.slate300, 0.2)

      const lineTotal = (ligne.qte ?? 0) * (ligne.pu ?? 0)
      txt(doc, ligne.desc ?? '',           COL.desc + 3, y + 5.8, { size: 8.5, color: N.slate900 })
      txt(doc, String(ligne.qte ?? 1),     COL.qte,      y + 5.8, { size: 8.5, color: N.slate700, align: 'center' })
      txt(doc, formatEur(ligne.pu ?? 0),   COL.pu,       y + 5.8, { size: 8.5, color: N.slate700, align: 'right' })
      txt(doc, formatEur(lineTotal),        COL.tot,      y + 5.8, { size: 8.5, color: N.slate900, bold: true, align: 'right' })
      y += rowH
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. TOTALS BLOCK
  // ══════════════════════════════════════════════════════════════════════════
  y += 6
  const tbX = PW / 2 + 5
  const tbW = PW - M - tbX

  fillRect(doc, tbX, y, tbW, 7, N.slate100)
  txt(doc, 'Sous-total HT',           tbX + 4,   y + 4.8, { size: 8, color: N.slate700 })
  txt(doc, formatEur(invoice.total),  PW - M - 3, y + 4.8, { size: 8, color: N.slate900, bold: true, align: 'right' })
  y += 7

  fillRect(doc, tbX, y, tbW, 7, N.white)
  hline(doc, tbX, y, tbX + tbW, N.slate300, 0.2)
  txt(doc, 'TVA',                              tbX + 4,   y + 4.8, { size: 8, color: N.slate500 })
  txt(doc, 'Non applicable — art. 293 B CGI', PW - M - 3, y + 4.8, { size: 7.5, color: N.slate500, align: 'right' })
  y += 7

  fillRect(doc, tbX, y, tbW, 10, PRIMARY)
  txt(doc, 'Total à payer',           tbX + 4,    y + 6.8, { size: 9, color: N.white, bold: true })
  txt(doc, formatEur(invoice.total),  PW - M - 3, y + 6.8, { size: 10, color: N.white, bold: true, align: 'right' })
  y += 10

  // ══════════════════════════════════════════════════════════════════════════
  // 6. BANK DETAILS
  // ══════════════════════════════════════════════════════════════════════════
  const hasBank = !!(profil.iban || invoice.iban || d.bic || d.bankName)
  if (hasBank) {
    y += 10
    hline(doc, M, y, PW - M, N.slate300)
    y += 5

    txt(doc, 'BANK DETAILS', M, y, { size: 8, color: N.slate900, bold: true })
    y += 5.5

    const iban  = profil.iban || invoice.iban || ''
    const titul = d.titulaire || profil.nom || ''

    if (d.bankName)   { txt(doc, d.bankName,          M, y, { size: 8, color: N.slate700 }); y += 4.5 }
    if (titul)        { txt(doc, `Titulaire du compte : ${titul}`, M, y, { size: 8, color: N.slate700 }); y += 4.5 }

    // BIC + IBAN on same line
    const bicIban = [d.bic ? `BIC : ${d.bic}` : '', iban ? `IBAN : ${iban}` : ''].filter(Boolean).join('   |   ')
    if (bicIban) { txt(doc, bicIban, M, y, { size: 8, color: N.slate900, bold: true }); y += 4.5 }

    if (d.bankDetails) { txt(doc, d.bankDetails, M, y, { size: 7.5, color: N.slate700 }); y += 4.5 }

    txt(doc, `Paiement : ${invoice.paiement}`, M, y, { size: 8, color: N.slate700 })
  }

  // Notes
  if (invoice.notes) {
    y += hasBank ? 8 : 10
    hline(doc, M, y, PW - M, N.slate300)
    y += 5
    txt(doc, 'NOTES', M, y, { size: 7.5, color: N.slate500, bold: true })
    y += 4.5
    const noteLines = doc.splitTextToSize(invoice.notes, PW - 2 * M - 10) as string[]
    for (const l of noteLines) { txt(doc, l, M, y, { size: 8, color: N.slate700 }); y += 4.5 }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. FOOTER
  // ══════════════════════════════════════════════════════════════════════════
  const FY = 285
  fillRect(doc, 0, FY, PW, 12, N.slate100)
  hline(doc, 0, FY, PW, N.slate300)
  txt(doc,
    'TVA non applicable, article 293B du CGI',
    PW / 2, FY + 4.5,
    { size: 7, color: N.slate500, align: 'center' }
  )
  const footerParts = [profil.nom, profil.siret ? `SIRET ${profil.siret}` : '', profil.adresse].filter(Boolean)
  txt(doc, footerParts.join(' • '), PW / 2, FY + 8.5, { size: 6.5, color: N.slate500, align: 'center' })

  return doc.output('datauristring')
}

// ─── Download helper ──────────────────────────────────────────────────────────
export async function downloadInvoicePdf(invoice: Invoice, profil: Profil): Promise<void> {
  const uri  = await generateInvoicePdf(invoice, profil)
  const link = document.createElement('a')
  link.href     = uri
  link.download = `${invoice.num}.pdf`
  link.click()
}

// ─── Base64 string (no data URI prefix) ──────────────────────────────────────
export async function generatePdfBase64(invoice: Invoice, profil: Profil): Promise<string> {
  const uri = await generateInvoicePdf(invoice, profil)
  return uri.split('base64,')[1] ?? ''
}
