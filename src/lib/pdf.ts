import type { Invoice, Profil } from './types'
import { DEFAULT_DESIGN } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type RGB = [number, number, number]

function hexToRgb(hex: string, fallback: RGB): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function fmtDate(d: string): string {
  if (!d) return '—'
  try { return new Intl.DateTimeFormat('fr-FR').format(new Date(d)) } catch { return d }
}

/** jsPDF standard fonts are WinAnsi — replace narrow no-break spaces from Intl */
function fmtMoney(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
    .format(n)
    .replace(/[\u202F\u00A0]/g, ' ')
}

/** Load a data-URI image to get its natural dimensions (returns null on failure) */
function loadImageSize(dataUri: string): Promise<{ w: number; h: number } | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = dataUri
  })
}

// ─── Layout constants (mm, A4 portrait 210×297) ───────────────────────────────

const PAGE_W  = 210
const PAGE_H  = 297
const ML      = 15           // left margin
const MR      = 15           // right margin
const MT      = 15           // top margin
const MB      = 18           // bottom margin
const CW      = PAGE_W - ML - MR  // content width = 180

// Table column widths (desc, qté, PU — the total column takes the rest of CW)
const COL_DESC  = 95
const COL_QTE   = 20
const COL_PU    = 30

// ─── Vector invoice builder ───────────────────────────────────────────────────

export async function buildInvoiceDoc(invoice: Invoice, profil: Profil) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const design  = { ...DEFAULT_DESIGN, ...(profil.design ?? {}) }
  const PRIMARY = hexToRgb(design.primaryColor, [26, 39, 68])
  const ACCENT  = hexToRgb(design.accentColor,  [37, 99, 235])
  const GRAY: RGB  = [100, 116, 139]
  const LIGHT: RGB = [232, 236, 240]

  let y = MT

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_H - MB) {
      doc.addPage()
      y = MT
    }
  }

  // ── Header: logo (image or drawn initials block) ───────────────────────────
  let logoDrawn = false
  if (profil.logo && /^data:image\/(png|jpe?g);/i.test(profil.logo)) {
    const size = await loadImageSize(profil.logo)
    if (size && size.w > 0 && size.h > 0) {
      const maxH = 20, maxW = 60
      const scale = Math.min(maxH / size.h, maxW / size.w)
      const w = size.w * scale, h = size.h * scale
      try {
        doc.addImage(profil.logo, /png/i.test(profil.logo) ? 'PNG' : 'JPEG', ML, y, w, h)
        logoDrawn = true
      } catch { /* fall back to drawn logo */ }
    }
  }
  if (!logoDrawn) {
    const nom      = (profil.nom || 'LP').trim()
    const initials = nom.split(/\s+/).slice(0, 3).map(w => w[0]?.toUpperCase() ?? '').join('')
    // Square with initials
    doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.8)
    doc.rect(ML, y, 20, 20)
    doc.setTextColor(...PRIMARY)
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text(initials, ML + 10, y + 10.5, { align: 'center' })
    doc.setFillColor(...ACCENT)
    doc.circle(ML + 10, y + 16, 1.8, 'F')
    // Vertical separator
    doc.setDrawColor(224, 224, 224); doc.setLineWidth(0.3)
    doc.line(ML + 24, y + 2, ML + 24, y + 18)
    // Company name + tagline
    doc.setTextColor(...PRIMARY)
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text(nom.toUpperCase(), ML + 28, y + 9)
    doc.setDrawColor(...ACCENT); doc.setLineWidth(0.5)
    doc.line(ML + 28, y + 11.5, ML + 28 + Math.min(62, doc.getTextWidth(nom.toUpperCase())), y + 11.5)
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(design.tagline || '', ML + 28, y + 16, { charSpace: 0.5 })
  }

  // ── Header: FACTURE block (right) ──────────────────────────────────────────
  doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...PRIMARY)
  doc.text('FACTURE', PAGE_W - MR, y + 7, { align: 'right' })
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ACCENT)
  doc.text(`N° ${invoice.num}`, PAGE_W - MR, y + 13, { align: 'right' })
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text(`Émise le ${fmtDate(invoice.date)}`, PAGE_W - MR, y + 18.5, { align: 'right' })
  doc.text(`Échéance : ${invoice.echeanceLabel || fmtDate(invoice.echeance)}`, PAGE_W - MR, y + 23, { align: 'right' })
  if (invoice.paiement) {
    doc.text(`Règlement : ${invoice.paiement}`, PAGE_W - MR, y + 27.5, { align: 'right' })
  }

  y += 34

  // ── From / To ──────────────────────────────────────────────────────────────
  const colFrom = ML
  const colTo   = ML + CW / 2 + 6
  const colW    = CW / 2 - 10

  function partyBlock(x: number, title: string, name: string, lines: string[]): number {
    let by = y
    doc.setFontSize(7); doc.setFont('helvetica', 'bold')
    doc.setTextColor(...ACCENT)
    doc.text(title.toUpperCase(), x, by, { charSpace: 0.6 })
    by += 5.5
    doc.setFontSize(10.5)
    doc.setTextColor(...PRIMARY)
    doc.text(name || '—', x, by)
    by += 5
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
    doc.setTextColor(85, 85, 85)
    for (const line of lines.filter(Boolean)) {
      const wrapped = doc.splitTextToSize(line, colW) as string[]
      doc.text(wrapped, x, by)
      by += wrapped.length * 4.2
    }
    return by
  }

  const fromLines = [
    profil.adresse || '',
    [profil.email, profil.tel].filter(Boolean).join('  ·  '),
    profil.siret ? `SIRET : ${profil.siret}` : '',
  ]
  const toLines = [
    invoice.clientAdresse || '',
    invoice.clientEmail || '',
    invoice.clientSiret ? `SIRET / Licence : ${invoice.clientSiret}` : '',
  ]
  const yFrom = partyBlock(colFrom, 'De', profil.nom, fromLines)
  const yTo   = partyBlock(colTo, 'Facturé à', invoice.clientNom, toLines)
  y = Math.max(yFrom, yTo) + 8

  // ── Prestations table ──────────────────────────────────────────────────────
  function tableHeader() {
    doc.setFillColor(...LIGHT)
    doc.rect(ML, y, CW, 9, 'F')
    doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.5)
    doc.line(ML, y + 9, ML + CW, y + 9)
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PRIMARY)
    doc.text('PRESTATION', ML + 4, y + 6)
    doc.text('QTÉ', ML + COL_DESC + COL_QTE / 2, y + 6, { align: 'center' })
    doc.text('P.U. HT', ML + COL_DESC + COL_QTE + COL_PU - 2, y + 6, { align: 'right' })
    doc.text('TOTAL HT', ML + CW - 4, y + 6, { align: 'right' })
    y += 9
  }

  ensureSpace(30)
  tableHeader()

  const lignes = Array.isArray(invoice.lignes) ? invoice.lignes : []
  doc.setFontSize(9)
  if (lignes.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(170, 170, 170)
    doc.text('Aucune prestation renseignée', ML + CW / 2, y + 7, { align: 'center' })
    y += 11
  }
  for (const l of lignes) {
    const wrapped = (doc.splitTextToSize(String(l.desc ?? ''), COL_DESC - 8) as string[])
    const rowH = Math.max(10, wrapped.length * 4.4 + 6)
    if (y + rowH > PAGE_H - MB) {
      doc.addPage(); y = MT
      tableHeader()
      doc.setFontSize(9)
    }
    doc.setFont('helvetica', 'normal'); doc.setTextColor(51, 51, 51)
    doc.text(wrapped, ML + 4, y + 6)
    doc.text(String(l.qte), ML + COL_DESC + COL_QTE / 2, y + 6, { align: 'center' })
    doc.text(fmtMoney(l.pu), ML + COL_DESC + COL_QTE + COL_PU - 2, y + 6, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.text(fmtMoney(l.qte * l.pu), ML + CW - 4, y + 6, { align: 'right' })
    doc.setDrawColor(238, 242, 247); doc.setLineWidth(0.2)
    doc.line(ML, y + rowH, ML + CW, y + rowH)
    y += rowH
  }

  y += 8

  // ── Totals ─────────────────────────────────────────────────────────────────
  ensureSpace(40)
  const totX = PAGE_W - MR - 78
  const totW = 78
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('Sous-total HT', totX, y + 4)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 51, 51)
  doc.text(fmtMoney(invoice.total), totX + totW, y + 4, { align: 'right' })
  doc.setDrawColor(238, 238, 238); doc.setLineWidth(0.2)
  doc.line(totX, y + 6.5, totX + totW, y + 6.5)

  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
  doc.setTextColor(187, 187, 187)
  doc.text('TVA', totX, y + 11)
  doc.text('Non applicable — art. 293 B CGI', totX + totW, y + 11, { align: 'right' })

  doc.setFillColor(...PRIMARY)
  doc.roundedRect(totX, y + 14.5, totW, 12, 2, 2, 'F')
  doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Total à payer', totX + 5, y + 22)
  doc.setTextColor(93, 212, 240)
  doc.text(fmtMoney(invoice.total), totX + totW - 5, y + 22, { align: 'right' })

  y += 36

  // ── Bank details + footer ──────────────────────────────────────────────────
  const bankLines = [
    design.bankName || '',
    [
      design.bic  ? `BIC : ${design.bic}`   : '',
      profil.iban ? `IBAN : ${profil.iban}` : '',
    ].filter(Boolean).join('   |   '),
    design.titulaire ? `Titulaire : ${design.titulaire}` : '',
    design.bankDetails || '',
  ].filter(Boolean)

  const notesWrapped = invoice.notes
    ? (doc.splitTextToSize(invoice.notes, CW - 12) as string[])
    : []
  const footerH = 14 + bankLines.length * 4.6 + (invoice.paiement ? 6 : 0)
    + (notesWrapped.length > 0 ? notesWrapped.length * 4.2 + 10 : 0) + 10
  ensureSpace(footerH)

  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.6)
  doc.line(ML, y, ML + CW, y)
  y += 7
  doc.setFontSize(8); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...PRIMARY)
  doc.text('COORDONNÉES BANCAIRES', ML, y, { charSpace: 0.6 })
  y += 5.5

  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
  if (bankLines.length > 0) {
    doc.setTextColor(68, 68, 68)
    for (const line of bankLines) {
      doc.text(line, ML, y)
      y += 4.6
    }
  } else {
    doc.setTextColor(170, 170, 170)
    doc.text('IBAN non configuré — rendez-vous dans Modèle facture', ML, y)
    y += 4.6
  }

  if (invoice.paiement) {
    y += 1.5
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...PRIMARY)
    doc.text(invoice.paiement, ML, y)
    y += 4.5
  }

  if (notesWrapped.length > 0) {
    y += 2
    const boxH = notesWrapped.length * 4.2 + 6
    doc.setFillColor(248, 248, 248)
    doc.roundedRect(ML, y, CW, boxH, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'normal'); doc.setTextColor(85, 85, 85)
    doc.text(notesWrapped, ML + 4, y + 5)
    y += boxH + 3
  }

  y += 4
  doc.setFontSize(7); doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text('TVA non applicable, article 293 B du Code Général des Impôts — Micro-entrepreneur', ML, y)

  return doc
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateInvoicePdf(invoice: Invoice, profil: Profil): Promise<string> {
  const doc = await buildInvoiceDoc(invoice, profil)
  return doc.output('datauristring')
}

export async function generatePdfBase64(invoice: Invoice, profil: Profil): Promise<string> {
  const uri = await generateInvoicePdf(invoice, profil)
  return uri.split('base64,')[1] ?? ''
}
