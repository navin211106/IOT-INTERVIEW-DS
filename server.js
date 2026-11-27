import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import fs from 'fs'
import ExcelJS from 'exceljs'
import nodemailer from 'nodemailer'

const app = express()
app.use(cors())
app.use(express.json())

const FILE = 'candidates.xlsx'
const PASSWORD = process.env.ADMIN_PASSWORD || 'Navin.2020'
const MAX = 5
const LOCK_MS = 15 * 60 * 1000
const COLS = ['Candidate_ID', 'Name', 'Email', 'Date', 'Technical_Answer', 'Communication_Score',
  'Confidence_Score', 'Technical_Score', 'Experience', 'Final_Score', 'Result']
let failed = 0
let lockedUntil = 0
const tokens = new Set()

async function openBook() {
  const wb = new ExcelJS.Workbook()
  if (fs.existsSync(FILE)) await wb.xlsx.readFile(FILE)
  let ws = wb.getWorksheet('Candidates')
  if (!ws) {
    ws = wb.addWorksheet('Candidates')
    ws.addRow(COLS).font = { bold: true }
    ws.columns.forEach((c, i) => { c.width = COLS[i] === 'Technical_Answer' ? 70 : 20 })
  }
  return { wb, ws }
}

async function alertOwner() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL } = process.env
  const text = `${MAX} wrong admin passwords were entered on your AI Interview System at ${new Date().toLocaleString()}.`
  console.warn('SECURITY ALERT:', text)
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !ALERT_EMAIL) return console.warn('Email not configured, alert only logged.')
  try {
    const mail = nodemailer.createTransport({ host: SMTP_HOST, port: +(SMTP_PORT || 587), auth: { user: SMTP_USER, pass: SMTP_PASS } })
    await mail.sendMail({ from: SMTP_USER, to: ALERT_EMAIL, subject: 'ALERT: failed admin logins', text })
  } catch (e) { console.error('Alert email failed:', e.message) }
}

const auth = (req, res, next) =>
  tokens.has((req.headers.authorization || '').replace('Bearer ', '')) ? next() : res.sendStatus(401)

app.post('/api/candidates', async (req, res) => {
  const b = req.body
  const nums = [b.communication, b.confidence, b.technical, b.final]
  if (!b.name || !b.email || nums.some((n) => typeof n !== 'number')) return res.status(400).json({ ok: false })
  const { wb, ws } = await openBook()
  const id = `C${String(ws.rowCount).padStart(3, '0')}`
  ws.addRow([id, b.name, b.email, b.date, b.answer, b.communication, b.confidence, b.technical, b.experience, b.final, b.result])
  await wb.xlsx.writeFile(FILE)
  res.json({ ok: true, id })
})

app.post('/api/admin/login', (req, res) => {
  if (Date.now() < lockedUntil) return res.status(429).json({ ok: false, locked: true, remaining: 0 })
  if (req.body.password === PASSWORD) {
    failed = 0
    const token = crypto.randomUUID()
    tokens.add(token)
    return res.json({ ok: true, token })
  }
  failed += 1
  if (failed >= MAX) {
    failed = 0
    lockedUntil = Date.now() + LOCK_MS
    alertOwner()
    return res.status(429).json({ ok: false, locked: true, remaining: 0 })
  }
  res.status(401).json({ ok: false, remaining: MAX - failed })
})

app.get('/api/admin/candidates', auth, async (req, res) => {
  const { ws } = await openBook()
  const rows = []
  ws.eachRow((row, n) => {
    if (n === 1) return
    rows.push(Object.fromEntries(COLS.map((c, i) => [c, row.getCell(i + 1).value])))
  })
  res.json(rows.reverse())
})

app.get('/api/admin/download', auth, async (req, res) => {
  await openBook().then(({ wb }) => wb.xlsx.writeFile(FILE))
  res.download(FILE)
})

app.listen(3001, () => console.log('Backend running on http://localhost:3001'))
