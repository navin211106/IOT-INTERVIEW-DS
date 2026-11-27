import { useState, useEffect, useRef } from 'react'
import './App.css'

const API = 'http://localhost:3001/api'
const COLORS = ['#8b8ff5', '#ff5a4e', '#eeeae2']

const QUESTIONS = [
  { q: 'Tell me about yourself and your background.', kw: ['student', 'project', 'experience', 'skills', 'learn', 'interest', 'college', 'work'] },
  { q: 'Explain a technical project you built and your role in it.', kw: ['built', 'developed', 'my role', 'responsible', 'used', 'team', 'python', 'react', 'data', 'implemented'] },
  { q: 'What is the difference between supervised and unsupervised learning?', kw: ['labeled', 'labelled', 'labels', 'unlabeled', 'cluster', 'classification', 'regression', 'training', 'predict'] },
  { q: 'Describe a time you handled a tight deadline or a stuck teammate.', kw: ['deadline', 'team', 'plan', 'priorit', 'communicat', 'helped', 'solved', 'time'] },
  { q: 'How does data travel from an IoT sensor to the cloud?', kw: ['sensor', 'microcontroller', 'esp32', 'wifi', 'mqtt', 'http', 'api', 'cloud', 'database', 'gateway'] },
  { q: 'What is an area you are improving, and how?', kw: ['improve', 'learn', 'practice', 'course', 'feedback', 'weakness', 'working on', 'habit'] },
]
const HEDGES = ['maybe', 'i guess', 'i think', 'not sure', 'sort of', 'kind of', 'probably', 'um', 'uh', 'perhaps']
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)))

// Rule-based scoring of typed answers (placeholder until the ML models are connected)
function scoreAnswers(answers) {
  let cm = 0, cf = 0, tc = 0
  answers.forEach((a, i) => {
    const t = a.toLowerCase()
    const w = t.split(/\s+/).filter(Boolean).length
    const sentences = (a.match(/[.!?]+/g) || []).length
    const hedges = HEDGES.filter((h) => new RegExp(`\\b${h}\\b`).test(t)).length
    const hits = QUESTIONS[i].kw.filter((k) => t.includes(k)).length
    cm += Math.min(w / 60, 1) * 65 + Math.min(sentences, 3) * 10 + (w > 0 ? 5 : 0)
    cf += w < 10 ? 35 : Math.max(30, 100 - hedges * 10)
    tc += Math.min(hits / 4, 1) * 80 + Math.min(w / 60, 1) * 20
  })
  const n = answers.length
  const communication = clamp(cm / n), confidence = clamp(cf / n), technical = clamp(tc / n)
  const final = clamp(0.3 * communication + 0.3 * confidence + 0.4 * technical)
  return { communication, confidence, technical, final, result: final >= 70 ? 'Selected' : 'Not Selected' }
}

const TECH = [
  { t: 'Machine learning', p: 'Cosine similarity compares each answer with the expected answer. OpenCV measures eye contact and facial stability, and MFCC voice features feed a CNN-LSTM that estimates stress.', tags: ['Python', 'OpenCV', 'MFCC', 'CNN-LSTM'] },
  { t: 'Cloud', p: 'Recordings and scores are stored in the cloud. A backend API runs the models and serves results to the dashboard.', tags: ['Node.js', 'Express', 'Excel export', 'REST API'] },
  { t: 'IoT', p: 'Edge devices feed live signals into the pipeline: a webcam, a microphone, and a pulse sensor on a microcontroller.', tags: ['ESP32', 'MQTT', 'Webcam', 'Pulse sensor'] },
]
const STEPS = [
  ['Capture', 'The candidate answers questions while the camera, microphone and IoT sensors record the session.'],
  ['Upload', 'Answers and sensor data stream securely to the backend and cloud storage.'],
  ['Analyse', 'Models score communication, confidence and technical knowledge.'],
  ['Report', 'The candidate sees their own score. Recruiters see every candidate in the private admin area.'],
]
const FAQ = [
  ['Is it free?', 'Yes. No account is needed. You type your answers to six questions in your browser.'],
  ['What will I be asked?', 'Six questions covering your background, a project, machine learning, teamwork, IoT and self-improvement.'],
  ['How is my score worked out?', 'Answer similarity 40%, speech clarity 30% and confidence 30%. A final score of 70 or more is Selected.'],
  ['Who can see my result?', 'Only you can see your score. Recruiters view results in the admin area, which needs a password.'],
  ['How long does it take?', 'About 10 minutes.'],
  ['Is real AI used?', 'Answers are scored with cosine similarity, your face is checked for eye contact and stability, and your voice is analysed with MFCC features. A CNN-LSTM emotion model is used once it has been trained.'],
]

function useRoute() {
  const get = () => window.location.hash.slice(1) || '/'
  const [r, setR] = useState(get)
  useEffect(() => {
    const f = () => setR(get())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}

function Pie({ c, f, t, final }) {
  const [on, setOn] = useState(null)
  const base = [['Speech clarity', 30, c], ['Confidence', 30, f], ['Answer similarity', 40, t]]
  const items = base.map(([n, w, s], i) => ({ n, w, s, col: COLORS[i], v: +((s * w) / 100).toFixed(1) }))
  const total = items.reduce((a, x) => a + x.v, 0) || 1
  let a0 = -Math.PI / 2
  const paths = items.map((x) => {
    const a = (x.v / total) * 2 * Math.PI
    const a1 = a0 + a
    const mid = a0 + a / 2
    const d = `M100 100 L${100 + 90 * Math.cos(a0)} ${100 + 90 * Math.sin(a0)} A90 90 0 ${a > Math.PI ? 1 : 0} 1 ${100 + 90 * Math.cos(a1)} ${100 + 90 * Math.sin(a1)} Z`
    a0 = a1
    return { ...x, d, dx: Math.cos(mid) * 8, dy: Math.sin(mid) * 8 }
  })
  const cur = on === null ? null : paths[on]
  return (
    <div className="pie">
      <svg viewBox="-10 -10 220 220" role="img" aria-label="Score breakdown pie chart">
        {paths.map((p, i) => (
          <path key={p.n} d={p.d} fill={p.col} stroke="#0a0a0d" strokeWidth="2"
            style={{ transform: on === i ? `translate(${p.dx}px, ${p.dy}px)` : 'none', transition: 'transform .2s', cursor: 'pointer' }}
            onMouseEnter={() => setOn(i)} onMouseLeave={() => setOn(null)} onClick={() => setOn(on === i ? null : i)} />
        ))}
      </svg>
      <div>
        <p className="eyebrow">{cur ? cur.n : 'Final score'}</p>
        <div className="big">{cur ? `${cur.v} pts` : `${final}/100`}</div>
        <p className="muted">{cur ? `Score ${cur.s}/100, weight ${cur.w}%` : 'Hover or tap a slice to see the breakdown.'}</p>
        <ul className="legend">
          {paths.map((p, i) => (
            <li key={p.n} className={on === i ? 'on' : ''} onMouseEnter={() => setOn(i)} onMouseLeave={() => setOn(null)}>
              <i style={{ background: p.col }} />{p.n} ({p.w}%): <b>{p.s}/100</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Head({ tag, title, accent, text }) {
  return (
    <>
      <p className="eyebrow">{tag}</p>
      <h1 className="display">{title} <span className="accent">{accent}</span></h1>
      {text && <p className="lead">{text}</p>}
    </>
  )
}

function Nav({ r }) {
  const L = [['/technology', 'Technology'], ['/how', 'How it works'], ['/results', 'Your results'], ['/admin', 'Admin']]
  return (
    <header className="nav">
      <div className="wrap">
        <a className="brand" href="#/"><img src="/logo.png" alt="" />AI Interview System</a>
        <nav className="links">
          {L.map(([h, n]) => <a key={h} href={`#${h}`} className={r === h ? 'on' : ''}>{n}</a>)}
        </nav>
      </div>
    </header>
  )
}

function Home() {
  const [s, setS] = useState({ 'Speech clarity': 70, Confidence: 70, 'Answer similarity': 70 })
  const final = Math.round(0.3 * s['Speech clarity'] + 0.3 * s.Confidence + 0.4 * s['Answer similarity'])
  const ok = final >= 70
  return (
    <>
      <section className="wrap hero">
        <Head tag="AI Interview System" title="Interviews scored" accent="in minutes." />
        <p className="lead">Answer six questions and get an instant scorecard on communication, confidence and technical knowledge.</p>
        <a className="pill" href="#/interview">TAKE THE INTERVIEW <b>FREE</b></a>
      </section>

      <section className="wrap rule">
        <div>
          <p className="eyebrow">The rule</p>
          <h2 className="display">Can you <span className="accent">pass?</span></h2>
          <p className="lead">Set how strong your answers are. Move one slider and watch the verdict turn.</p>
          {Object.keys(s).map((k) => (
            <label className="slider" key={k}>
              <span>{k}</span>
              <input type="range" min="0" max="100" value={s[k]} onChange={(e) => setS({ ...s, [k]: +e.target.value })} />
              <b>{s[k]}</b>
            </label>
          ))}
        </div>
        <div className="stage">
          <div className="bars">
            {Object.keys(s).map((k) => <div key={k}><i style={{ height: `${s[k] * 1.6}px`, background: ok ? '#8b8ff5' : '#ff5a4e' }} />{k}</div>)}
          </div>
          <div className="verdict">
            <span className={ok ? 'stamp ok' : 'stamp'}>{ok ? 'SELECTED' : 'NOT YET'}</span>
            <div><b>Final score {final}/100</b><p className="muted small">Selected needs 70 or higher.</p></div>
          </div>
          <a className="pill wide" href="#/interview">TAKE THE REAL ONE <b>FREE SCORE</b></a>
          <p className="muted small" style={{ marginTop: '.8rem' }}>A simulation of the rule. The real interview scores your own answers.</p>
        </div>
      </section>

      <section className="wrap">
        <div className="card cta">
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2 className="display">Six questions. <span className="accent">one honest score.</span></h2>
          </div>
          <a className="pill" href="#/interview">START NOW</a>
        </div>
      </section>

      <section className="wrap">
        <p className="eyebrow">Questions people ask</p>
        <div className="faq">{FAQ.map(([q, a]) => <div key={q}><h3>{q}</h3><p>{a}</p></div>)}</div>
      </section>
    </>
  )
}

const Tech = () => (
  <section className="wrap page">
    <Head tag="Technology" title="Built on" accent="three layers." text="Machine learning does the thinking, the cloud holds the data, and IoT devices capture the session." />
    <div className="grid3">
      {TECH.map((x) => (
        <div className="card" key={x.t}><h3>{x.t}</h3><p>{x.p}</p><div className="tags">{x.tags.map((g) => <span key={g}>{g}</span>)}</div></div>
      ))}
    </div>
    <div className="card" style={{ marginTop: '1.25rem' }}>
      <p className="eyebrow">Scoring formula</p>
      <p className="formula">Score = 0.4 x Similarity + 0.3 x Clarity + 0.3 x Confidence</p>
      <p className="muted">Similarity is the cosine similarity between your answer and the expected answer. Clarity is words spoken per minute, with full marks at 150. Confidence combines voice confidence from the MFCC analysis with the steadiness of your language.</p>
    </div>
  </section>
)

const How = () => (
  <section className="wrap page">
    <Head tag="How it works" title="From answer to" accent="scorecard." text="Four steps, start to finish." />
    <div className="steps">
      {STEPS.map(([t, p], i) => (
        <div className="card step" key={t}><span className="num">{i + 1}</span><div><h3>{t}</h3><p>{p}</p></div></div>
      ))}
    </div>
  </section>
)

const ML = 'http://localhost:5000'
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition

// Encode recorded microphone samples as a 16-bit mono WAV file
function toWav(chunks, rate) {
  const len = chunks.reduce((a, c) => a + c.length, 0)
  const v = new DataView(new ArrayBuffer(44 + len * 2))
  const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, len * 2, true)
  let o = 44
  for (const c of chunks) for (const s of c) { const x = Math.max(-1, Math.min(1, s)); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2 }
  return new Blob([v], { type: 'audio/wav' })
}

// Sends each answer (text, voice clip and webcam frames) to the ML service.
// Score = 0.4 x Similarity + 0.3 x Clarity + 0.3 x Confidence (as in the reference paper).
async function analyse(all, clips, shots, times) {
  try {
    const parts = await Promise.all(all.map(async (a, n) => {
      const fd = new FormData()
      fd.append('q', n)
      fd.append('transcript', a)
      fd.append('seconds', times[n] || 0)
      if (clips[n]) fd.append('audio', clips[n], 'answer.wav')
      for (const [k, b] of (shots[n] || []).entries()) fd.append('frames', b, `f${k}.jpg`)
      const res = await fetch(`${ML}/analyze`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('ml')
      return res.json()
    }))
    const avg = (k) => clamp(parts.reduce((s, p) => s + p[k], 0) / parts.length)
    const mean = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null)
    const faces = parts.map((p) => p.face).filter(Boolean)
    const vs = parts.map((p) => p.voice).filter(Boolean)
    const technical = avg('technical'), communication = avg('communication'), confidence = avg('confidence')
    const final = clamp(0.4 * technical + 0.3 * communication + 0.3 * confidence)
    return {
      technical, communication, confidence, final, result: final >= 70 ? 'Selected' : 'Not Selected',
      engine: `Cosine similarity, speech clarity${faces.length ? ', face analysis' : ''}${vs.length ? ', MFCC voice analysis' : ''}`,
      eyeContact: mean(faces.map((f) => f.eye_contact)), stability: mean(faces.map((f) => f.stability)),
      speechRate: mean(parts.map((p) => p.wpm)),
      stress: mean(vs.map((v) => v.stress)), voiceConfidence: mean(vs.map((v) => v.confidence)),
      pauseRatio: vs.length ? Math.round((vs.reduce((s, v) => s + v.pause_ratio, 0) / vs.length) * 100) : null,
    }
  } catch {
    return { ...scoreAnswers(all), engine: 'Basic text analysis (ML service offline)', eyeContact: null, stability: null, stress: null, voiceConfidence: null, speechRate: null, pauseRatio: null }
  }
}

function Interview() {
  const [info, setInfo] = useState({ name: '', email: '', experience: 'Fresher' })
  const [started, setStarted] = useState(false)
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState([])
  const [clips, setClips] = useState([])
  const [text, setText] = useState('')
  const [clip, setClip] = useState(null)
  const [shot, setShot] = useState([])
  const [shots, setShots] = useState([])
  const videoRef = useRef(null)
  const qStart = useRef(Date.now())
  const times = useRef([])
  const [recording, setRecording] = useState(false)
  const [micErr, setMicErr] = useState('')
  const [busy, setBusy] = useState(false)
  const rec = useRef(null)
  const base = useRef('')

  const startRec = async () => {
    setMicErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      const chunks = []
      proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      src.connect(proc)
      proc.connect(ctx.destination)
      let sr = null
      if (SpeechRec) {
        sr = new SpeechRec()
        sr.continuous = true
        sr.interimResults = true
        sr.lang = 'en-IN'
        base.current = text ? `${text} ` : ''
        sr.onresult = (e) => {
          let t = ''
          for (let k = 0; k < e.results.length; k++) t += e.results[k][0].transcript
          setText(base.current + t)
        }
        sr.onerror = () => {}
        sr.start()
      }
      const frames = []
      let cam = null
      let timer = null
      try {
        cam = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        videoRef.current.srcObject = cam
        const cv = document.createElement('canvas')
        cv.width = 320
        cv.height = 240
        timer = setInterval(() => {
          const v = videoRef.current
          if (!v || !v.videoWidth || frames.length >= 40) return
          cv.getContext('2d').drawImage(v, 0, 0, 320, 240)
          cv.toBlob((b) => b && frames.push(b), 'image/jpeg', 0.7)
        }, 500)
      }catch (err) { setMicErr('Camera not available (' + err.name + '), so eye contact and stability cannot be scored.') }
      rec.current = { stream, ctx, src, proc, chunks, sr, cam, timer, frames }
      setClip(null)
      setShot([])
      setRecording(true)
    } catch {
      setMicErr('Microphone not available. Allow access in the browser, or type your answer instead.')
    }
  }

  const stopRec = () => {
    const r = rec.current
    if (!r) return
    if (r.sr) r.sr.stop()
    r.proc.disconnect()
    r.src.disconnect()
    r.stream.getTracks().forEach((t) => t.stop())
    clearInterval(r.timer)
    if (r.cam) r.cam.getTracks().forEach((t) => t.stop())
    setShot(r.frames)
    setClip(toWav(r.chunks, r.ctx.sampleRate))
    r.ctx.close()
    rec.current = null
    setRecording(false)
  }

  const next = async (e) => {
    e.preventDefault()
    const all = [...answers, text.trim()]
    const allClips = [...clips, clip]
    const allShots = [...shots, shot]
    times.current.push((Date.now() - qStart.current) / 1000)
    if (i < QUESTIONS.length - 1) {
      setAnswers(all); setClips(allClips); setShots(allShots); setText(''); setClip(null); setShot([])
      qStart.current = Date.now()
      setI(i + 1)
      return
    }
    setBusy(true)
    const record = {
      ...info, ...(await analyse(all, allClips, allShots, times.current)), date: new Date().toLocaleString(),
      answer: all.map((a, n) => `Q${n + 1}: ${a}`).join(' | '),
    }
    try {
      const res = await fetch(`${API}/candidates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) })
      record.saved = res.ok
    } catch { record.saved = false }
    localStorage.setItem('lastResult', JSON.stringify(record))
    window.location.hash = '#/results'
  }

  if (!started) {
    return (
      <section className="wrap page">
        <Head tag="Take the interview" title="First, a few" accent="details." />
        <form className="card" onSubmit={(e) => { e.preventDefault(); qStart.current = Date.now(); setStarted(true) }}>
          <label className="f">Full name<input className="t" required value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></label>
          <label className="f">Email<input className="t" type="email" required value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} /></label>
          <label className="f">Experience
            <select className="t" value={info.experience} onChange={(e) => setInfo({ ...info, experience: e.target.value })}>
              {['Fresher', '1 year', '2 years', '3 years', '4+ years'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <p className="muted small">You will speak your answers. Your voice, pace, eye contact and facial stability are analysed. Use Chrome or Edge and allow the microphone and camera.</p>
          <button className="pill" type="submit">BEGIN</button>
        </form>
      </section>
    )
  }
  return (
    <section className="wrap page">
      <p className="eyebrow">Question {i + 1} of {QUESTIONS.length}</p>
      <p className="q">{QUESTIONS[i].q}</p>
      <form className="card" onSubmit={next}>
        <video ref={videoRef} className={recording ? 'cam' : 'cam off'} autoPlay muted playsInline />
        <div className="microw">
          <button type="button" className={recording ? 'pill rec' : 'pill ghost'} onClick={recording ? stopRec : startRec}>
            {recording ? 'STOP RECORDING' : clip ? 'RECORD AGAIN' : 'START RECORDING'}
          </button>
          {recording && <span className="err">Recording... speak now</span>}
          {clip && !recording && <span className="ok-text">Voice recorded</span>}
        </div>
        {micErr && <p className="err" role="alert">{micErr}</p>}
        <textarea className="t" required value={text} onChange={(e) => setText(e.target.value)}
          placeholder={SpeechRec ? 'Your spoken answer appears here. You can edit it.' : 'Live transcript is not supported in this browser. Type your answer here after recording.'} />
        {!clip && !recording && <p className="muted small">No recording: speech clarity will be scored 0 for this answer.</p>}
        <button className="pill" type="submit" disabled={busy || recording}>
          {busy ? 'ANALYSING...' : i < QUESTIONS.length - 1 ? 'NEXT QUESTION' : 'FINISH AND SEE SCORE'}
        </button>
      </form>
    </section>
  )
}

function Results() {
  let r = null
  try { r = JSON.parse(localStorage.getItem('lastResult')) } catch { r = null }
  if (!r) {
    return (
      <section className="wrap page">
        <Head tag="Your results" title="Nothing here" accent="yet." text="Take the interview to get your scorecard." />
        <a className="pill" href="#/interview">TAKE THE INTERVIEW</a>
      </section>
    )
  }
  const tips = []
  if (r.technical < 50) tips.push('Your answers were far from the expected answers. Cover the key concepts of each question.')
  if (r.communication < 60) tips.push('Speech clarity is low. Record every answer and speak at a steady pace, about 150 words per minute, without long pauses.')
  if (r.confidence < 60) tips.push('Confidence is low. Reduce hesitation words such as maybe and I think, and speak steadily.')
  if (!tips.length) tips.push('Strong performance. Keep practising to stay consistent.')
  return (
    <section className="wrap page">
      <Head tag="Your results" title={`${r.name},`} accent="here is your score." />
      <div className="card"><Pie c={r.communication} f={r.confidence} t={r.technical} final={r.final} /></div>
      <div className="metrics">
        {[['Eye contact', r.eyeContact, '%'], ['Facial stability', r.stability, '%'], ['Speech rate', r.speechRate, ' wpm'], ['Stress level', r.stress, '%'], ['Voice confidence', r.voiceConfidence, '%'], ['Pauses', r.pauseRatio, '%']]
          .filter(([, v]) => v != null)
          .map(([k, v, u]) => (
            <div className="card" key={k}><p className="eyebrow">{k}</p><div className="big2">{v}{u}</div></div>
          ))}
      </div>
      <p className="muted small" style={{ marginTop: '1rem' }}>Score = 0.4 x Similarity (technical) + 0.3 x Clarity (communication) + 0.3 x Confidence (eye contact and facial stability)</p>
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <p className="eyebrow">Feedback</p>
        <ul className="fb">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
      <p className="muted small" style={{ marginTop: '1rem' }}>Analysis: {r.engine}</p>
      <p style={{ marginTop: '1rem' }}>
        Result: <span className={r.result === 'Selected' ? 'tag yes' : 'tag no'}>{r.result}</span>
        {!r.saved && <span className="err"> Your result could not be sent to the server, so recruiters cannot see it yet.</span>}
      </p>
    </section>
  )
}

function Admin() {
  const [tok, setTok] = useState(sessionStorage.getItem('adm') || '')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [rows, setRows] = useState([])
  const [sel, setSel] = useState(null)
  const head = { Authorization: `Bearer ${tok}` }

  const login = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
      const d = await res.json()
      if (d.ok) { sessionStorage.setItem('adm', d.token); setTok(d.token); setMsg('') }
      else if (d.locked) setMsg('Too many invalid attempts. Access is locked for 15 minutes and the owner has been notified.')
      else setMsg(`Invalid password. Attempts remaining: ${d.remaining} of 5.`)
    } catch { setMsg('Cannot reach the server. Start it with: npm run server') }
    setPw('')
  }

  useEffect(() => {
    if (!tok) return
    fetch(`${API}/admin/candidates`, { headers: head })
      .then((r) => { if (r.status === 401) { sessionStorage.removeItem('adm'); setTok(''); throw new Error('auth') } return r.json() })
      .then(setRows).catch(() => {})
  }, [tok])

  const download = async () => {
    const blob = await (await fetch(`${API}/admin/download`, { headers: head })).blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'candidates.xlsx'
    a.click()
  }

  if (!tok) {
    return (
      <section className="wrap page">
        <Head tag="Admin" title="Restricted" accent="access." />
        <form className="card" onSubmit={login}>
          <label className="f">Password<input className="t" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          {msg && <p className="err" role="alert">{msg}</p>}
          <button className="pill" type="submit">UNLOCK</button>
        </form>
      </section>
    )
  }
  const c = rows.find((x) => x.Candidate_ID === sel)
  return (
    <section className="wrap page">
      <Head tag="Admin" title="All" accent="candidates." />
      <button className="pill" onClick={download}>DOWNLOAD EXCEL</button>
      <div className="table-scroll">
        <table>
          <thead><tr>{['ID', 'Name', 'Email', 'Experience', 'Comm.', 'Conf.', 'Tech.', 'Final', 'Stress', 'WPM', 'Result', 'Date'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.Candidate_ID} className={sel === x.Candidate_ID ? 'pick on' : 'pick'} tabIndex={0}
                onClick={() => setSel(x.Candidate_ID)} onKeyDown={(e) => e.key === 'Enter' && setSel(x.Candidate_ID)}>
                <td>{x.Candidate_ID}</td><td>{x.Name}</td><td>{x.Email}</td><td>{x.Experience}</td>
                <td>{x.Communication_Score}</td><td>{x.Confidence_Score}</td><td>{x.Technical_Score}</td><td>{x.Final_Score}</td><td>{x.Stress_Level || '-'}</td><td>{x.Speech_Rate_WPM || '-'}</td>
                <td><span className={x.Result === 'Selected' ? 'tag yes' : 'tag no'}>{x.Result}</span></td><td>{x.Date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="muted" style={{ marginTop: '1rem' }}>No candidates yet.</p>}
      {c && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <Pie c={c.Communication_Score} f={c.Confidence_Score} t={c.Technical_Score} final={c.Final_Score} />
          <p className="muted small" style={{ marginTop: '1rem' }}>{c.Technical_Answer}</p>
        </div>
      )}
    </section>
  )
}

export default function App() {
  const r = useRoute()
  useEffect(() => { window.scrollTo(0, 0) }, [r])
  const pages = { '/': <Home />, '/technology': <Tech />, '/how': <How />, '/interview': <Interview />, '/results': <Results />, '/admin': <Admin /> }
  return (
    <>
      <Nav r={r} />
      <main>{pages[r] || <Home />}</main>
      <footer><div className="wrap">Academic project: AI-Powered Automated Interview Process using Machine Learning, Cloud and IoT</div></footer>
    </>
  )
}