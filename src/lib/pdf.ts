import type { Invoice, Profil } from './types'
import { formatEur, formatDate } from './utils'

// jsPDF is loaded dynamically to avoid SSR issues
async function getJsPDF() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  navy:       [26,  39,  68] as [number, number, number],
  blue:       [37, 99,  235] as [number, number, number],
  blueLight:  [59, 130, 246] as [number, number, number],
  slate900:   [15,  23,  42] as [number, number, number],
  slate700:   [51,  65,  85] as [number, number, number],
  slate500:   [100, 116, 139] as [number, number, number],
  slate300:   [203, 213, 225] as [number, number, number],
  slate100:   [241, 245, 249] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  green:      [21, 128,  61] as [number, number, number],
  greenBg:    [240, 253, 244] as [number, number, number],
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function rect(doc: InstanceType<Awaited<ReturnType<typeof getJsPDF>>>, x: number, y: number, w: number, h: number, color: [number, number, number], style: 'F' | 'S' | 'FD' = 'F') {
  doc.setFillColor(...color)
  doc.setDrawColor(...color)
  doc.rect(x, y, w, h, style)
}

function text(doc: InstanceType<Awaited<ReturnType<typeof getJsPDF>>>, str: string, x: number, y: number, opts?: { size?: number; color?: [number, number, number]; bold?: boolean; align?: 'left' | 'right' | 'center' }) {
  doc.setFontSize(opts?.size ?? 9)
  doc.setTextColor(...(opts?.color ?? C.slate700))
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  doc.text(str, x, y, { align: opts?.align ?? 'left' })
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateInvoicePdf(invoice: Invoice, profil: Profil): Promise<string> {
  const JsPDF = await getJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })

  const PW = 210  // page width
  const M  = 15   // margin

  // ── 1. Header band ──────────────────────────────────────────────────────────
  rect(doc, 0, 0, PW, 40, C.navy)

  // Logo area (left)
  if (profil.logo) {
    try {
      const ext = profil.logo.includes('png') ? 'PNG' : 'JPEG'
      doc.addImage(profil.logo, ext, M, 8, 24, 24)
    } catch {}
  } else {
    // Text logo fallback
    rect(doc, M, 8, 28, 24, C.blue)
    text(doc, 'TNS', M + 14, 22, { size: 13, color: C.white, bold: true, align: 'center' })
  }

  // Company name + tagline
  text(doc, profil.nom || 'THE NEXT STEP', M + 34, 16, { size: 13, color: C.white, bold: true })
  text(doc, 'CONSULTING & STRATEGY', M + 34, 22, { size: 7.5, color: [148, 163, 184] })
  if (profil.siret) {
    text(doc, `SIRET ${profil.siret}`, M + 34, 28, { size: 7.5, color: [148, 163, 184] })
  }

  // Invoice badge (right)
  rect(doc, PW - M - 50, 10, 50, 20, C.blue)
  text(doc, 'FACTURE', PW - M - 25, 18, { size: 9, color: C.white, bold: true, align: 'center' })
  text(doc, invoice.num, PW - M - 25, 25, { size: 9.5, color: C.white, bold: true, align: 'center' })

  // ── 2. Date row ─────────────────────────────────────────────────────────────
  rect(doc, 0, 40, PW, 10, C.slate100)
  text(doc, `Date d'émission : ${formatDate(invoice.date)}`, M, 46.5, { size: 8, color: C.slate700 })
  text(doc, `Échéance : ${formatDate(invoice.echeance)} (${invoice.echeanceLabel || '30 jours'})`, PW / 2, 46.5, { size: 8, color: C.slate700 })
  text(doc, `Paiement : ${invoice.paiement}`, PW - M, 46.5, { size: 8, color: C.slate700, align: 'right' })

  // ── 3. Addresses ────────────────────────────────────────────────────────────
  let y = 58

  // Emetteur (left)
  text(doc, 'DE', M, y, { size: 7, color: C.slate500, bold: true })
  doc.setDrawColor(...C.blue)
  doc.setLineWidth(0.5)
  doc.line(M + 8, y - 1, M + 22, y - 1)
  y += 5
  text(doc, profil.nom || 'THE NEXT STEP', M, y, { size: 9, color: C.slate900, bold: true })
  y += 5
  if (profil.adresse) {
    const addrLines = profil.adresse.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    addrLines.forEach(line => {
      text(doc, line, M, y, { size: 8, color: C.slate700 })
      y += 4.5
    })
  }
  if (profil.email) { text(doc, profil.email, M, y, { size: 8, color: C.slate700 }); y += 4.5 }
  if (profil.tel)   { text(doc, profil.tel,   M, y, { size: 8, color: C.slate700 }); y += 4.5 }

  // Destinataire (right)
  let yr = 58
  const rx = PW / 2 + 5
  text(doc, 'À', rx, yr, { size: 7, color: C.slate500, bold: true })
  yr += 5
  rect(doc, rx, yr - 4, PW - rx - M, 0.3, C.blue)

  text(doc, invoice.clientNom, rx, yr, { size: 9, color: C.slate900, bold: true })
  yr += 5
  if (invoice.clientSiret) {
    text(doc, `SIRET ${invoice.clientSiret}`, rx, yr, { size: 8, color: C.slate500 })
    yr += 4.5
  }
  if (invoice.clientAdresse) {
    const lines = invoice.clientAdresse.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    lines.forEach(line => {
      text(doc, line, rx, yr, { size: 8, color: C.slate700 })
      yr += 4.5
    })
  }
  if (invoice.clientEmail) { text(doc, invoice.clientEmail, rx, yr, { size: 8, color: C.slate700 }) }

  // ── 4. Line items table ──────────────────────────────────────────────────────
  y = Math.max(y, yr) + 10

  // Table header
  const COL = { desc: M, qte: 120, pu: 148, total: 175 }
  rect(doc, M, y, PW - 2 * M, 8, C.navy)
  text(doc, 'DESCRIPTION',    COL.desc  + 2, y + 5.2, { size: 7.5, color: C.white, bold: true })
  text(doc, 'QTÉ',            COL.qte,        y + 5.2, { size: 7.5, color: C.white, bold: true, align: 'center' })
  text(doc, 'PRIX UNIT. HT',  COL.pu,         y + 5.2, { size: 7.5, color: C.white, bold: true, align: 'right' })
  text(doc, 'TOTAL HT',       PW - M - 2,     y + 5.2, { size: 7.5, color: C.white, bold: true, align: 'right' })
  y += 8

  // Rows
  invoice.lignes.forEach((ligne, i) => {
    const bg = i % 2 === 0 ? C.white : C.slate100
    const rowH = 8
    rect(doc, M, y, PW - 2 * M, rowH, bg)

    // Border bottom
    doc.setDrawColor(...C.slate300)
    doc.setLineWidth(0.2)
    doc.line(M, y + rowH, PW - M, y + rowH)

    const lineTotal = ligne.qte * ligne.pu

    text(doc, ligne.desc,                          COL.desc + 2, y + 5.2, { size: 8.5, color: C.slate900 })
    text(doc, String(ligne.qte),                   COL.qte,       y + 5.2, { size: 8.5, color: C.slate700, align: 'center' })
    text(doc, formatEur(ligne.pu),                 COL.pu,        y + 5.2, { size: 8.5, color: C.slate700, align: 'right' })
    text(doc, formatEur(lineTotal),                PW - M - 2,    y + 5.2, { size: 8.5, color: C.slate900, bold: true, align: 'right' })

    y += rowH
  })

  // ── 5. Totals block ──────────────────────────────────────────────────────────
  y += 6
  const totalBoxX = PW / 2 + 5
  const totalBoxW = PW - M - totalBoxX

  // Subtotal row
  rect(doc, totalBoxX, y, totalBoxW, 7, C.slate100)
  text(doc, 'Sous-total HT',   totalBoxX + 4,   y + 4.8, { size: 8, color: C.slate700 })
  text(doc, formatEur(invoice.total), PW - M - 3, y + 4.8, { size: 8, color: C.slate900, bold: true, align: 'right' })
  y += 7

  // TVA
  rect(doc, totalBoxX, y, totalBoxW, 7, C.white)
  doc.setDrawColor(...C.slate300)
  doc.setLineWidth(0.2)
  doc.line(totalBoxX, y, totalBoxX + totalBoxW, y)
  text(doc, 'TVA (0%)',         totalBoxX + 4, y + 4.8, { size: 8, color: C.slate500 })
  text(doc, '—',                PW - M - 3,   y + 4.8, { size: 8, color: C.slate500, align: 'right' })
  y += 7

  // Total TTC
  rect(doc, totalBoxX, y, totalBoxW, 10, C.navy)
  text(doc, 'TOTAL TTC',        totalBoxX + 4, y + 6.5, { size: 9, color: C.white, bold: true })
  text(doc, formatEur(invoice.total), PW - M - 3, y + 6.5, { size: 10, color: C.white, bold: true, align: 'right' })
  y += 10

  // ── 6. Payment info ──────────────────────────────────────────────────────────
  if (profil.iban || invoice.iban) {
    y += 8
    rect(doc, M, y, PW - 2 * M, 0.4, C.slate300)
    y += 5
    text(doc, 'INFORMATIONS DE PAIEMENT', M, y, { size: 7, color: C.slate500, bold: true })
    y += 4.5
    text(doc, `Mode : ${invoice.paiement}`, M, y, { size: 8, color: C.slate700 })
    if (profil.iban || invoice.iban) {
      y += 4.5
      text(doc, `IBAN : ${profil.iban || invoice.iban}`, M, y, { size: 8, color: C.slate700, bold: true })
    }
    y += 4.5
    text(doc, `Bénéficiaire : ${profil.nom}`, M, y, { size: 8, color: C.slate700 })
  }

  // Notes
  if (invoice.notes) {
    y += 8
    text(doc, 'NOTES', M, y, { size: 7, color: C.slate500, bold: true })
    y += 4.5
    const noteLines = doc.splitTextToSize(invoice.notes, PW - 2 * M - 10)
    noteLines.forEach((line: string) => {
      text(doc, line, M, y, { size: 8, color: C.slate700 })
      y += 4.5
    })
  }

  // ── 7. Footer ────────────────────────────────────────────────────────────────
  const FOOTER_Y = 285
  rect(doc, 0, FOOTER_Y, PW, 12, C.slate100)
  text(doc,
    'TVA non applicable, article 293B du CGI',
    PW / 2, FOOTER_Y + 4.5,
    { size: 7, color: C.slate500, align: 'center' }
  )
  text(doc,
    `${profil.nom}${profil.siret ? ` • SIRET ${profil.siret}` : ''}${profil.adresse ? ` • ${profil.adresse}` : ''}`,
    PW / 2, FOOTER_Y + 8.5,
    { size: 6.5, color: C.slate500, align: 'center' }
  )

  // ── 8. Return base64 ─────────────────────────────────────────────────────────
  return doc.output('datauristring')
}

export async function downloadInvoicePdf(invoice: Invoice, profil: Profil): Promise<void> {
  const JsPDF = await getJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })

  // Re-generate into doc for download (same logic, but use save)
  const dataUri = await generateInvoicePdf(invoice, profil)
  const link = document.createElement('a')
  link.href = dataUri
  link.download = `${invoice.num}.pdf`
  link.click()
}

// ─── Returns base64 string (no data URI prefix) ───────────────────────────────
export async function generatePdfBase64(invoice: Invoice, profil: Profil): Promise<string> {
  const JsPDF = await getJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })

  const dataUri = await generateInvoicePdf(invoice, profil)
  // Strip "data:application/pdf;filename=generated.pdf;base64,"
  return dataUri.split('base64,')[1] ?? ''
}
