import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import './App.css'

type TeacherProfile = {
  name: string
  email: string
  picture?: string
}

type Classroom = {
  id: string
  name: string
  students: string[]
}

type GoogleCredentialResponse = {
  credential?: string
}

const APP_STORAGE_KEY = 'spark-classroom-picker'
const TEACHER_STORAGE_KEY = `${APP_STORAGE_KEY}:teacher`
const SAMPLE_CLASS_NAME = 'Sunshine Squad'
const SAMPLE_STUDENTS = [
  'Amelia',
  'Arlo',
  'Ava',
  'Charlie',
  'Chloe',
  'Elijah',
  'Ellie',
  'George',
  'Harper',
  'Ivy',
  'Jack',
  'Leo',
  'Lily',
  'Maya',
  'Milo',
  'Noah',
  'Olivia',
  'Poppy',
  'Ruby',
  'Theo',
]
const WHEEL_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#60a5fa', '#818cf8', '#f472b6']
const GROUP_TITLES = ['Rainbow', 'Starlight', 'Sunbeam', 'Confetti', 'Sprout', 'Rocket', 'Kindness', 'Treasure']

function loadTeacher(): TeacherProfile | null {
  try {
    const raw = window.localStorage.getItem(TEACHER_STORAGE_KEY)

    return raw ? (JSON.parse(raw) as TeacherProfile) : null
  } catch {
    return null
  }
}

function loadClasses(email: string): Classroom[] {
  try {
    const raw = window.localStorage.getItem(`${APP_STORAGE_KEY}:classes:${encodeURIComponent(email.toLowerCase())}`)

    return raw ? (JSON.parse(raw) as Classroom[]) : []
  } catch {
    return []
  }
}

function saveTeacher(teacher: TeacherProfile | null) {
  if (!teacher) {
    window.localStorage.removeItem(TEACHER_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(teacher))
}

function saveClasses(email: string, classes: Classroom[]) {
  window.localStorage.setItem(
    `${APP_STORAGE_KEY}:classes:${encodeURIComponent(email.toLowerCase())}`,
    JSON.stringify(classes),
  )
}

function decodeBase64Url(value: string) {
  const normalised = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, '=')
  const binary = window.atob(padded)

  try {
    return decodeURIComponent(
      Array.from(binary)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
  } catch {
    return binary
  }
}

function getTeacherFromCredential(credential: string): TeacherProfile {
  const [, payload] = credential.split('.')

  if (!payload) {
    throw new Error('Missing Google profile payload.')
  }

  const parsed = JSON.parse(decodeBase64Url(payload)) as {
    email?: string
    name?: string
    picture?: string
  }

  if (!parsed.email || !parsed.name) {
    throw new Error('Google account information was incomplete.')
  }

  return {
    name: parsed.name,
    email: parsed.email,
    picture: parsed.picture,
  }
}

function splitStudentDraft(value: string) {
  return value
    .split(/\r?\n|,/g)
    .map((student) => student.trim())
    .filter(Boolean)
}

function dedupeStudents(students: string[]) {
  const seen = new Set<string>()

  return students.filter((student) => {
    const key = student.toLowerCase()

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function shuffleStudents(students: string[]) {
  const next = [...students]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

function makeGroups(students: string[], size: number) {
  const safeSize = Math.max(2, size)
  const shuffled = shuffleStudents(students)
  const groupCount = Math.ceil(shuffled.length / safeSize)
  const groups = Array.from({ length: groupCount }, () => [] as string[])

  shuffled.forEach((student, index) => {
    groups[index % groupCount].push(student)
  })

  return groups.filter((group) => group.length > 0)
}

function buildWheelBackground(students: string[]) {
  if (students.length === 0) {
    return 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,255,255,0.72))'
  }

  const segmentSize = 360 / students.length
  const segments = students.map((_, index) => {
    const start = index * segmentSize
    const end = start + segmentSize
    const color = WHEEL_COLORS[index % WHEEL_COLORS.length]

    return `${color} ${start}deg ${end}deg`
  })

  return `conic-gradient(from -90deg, ${segments.join(', ')})`
}

function App() {
  const [teacher, setTeacher] = useState<TeacherProfile | null>(() => loadTeacher())
  const [classes, setClasses] = useState<Classroom[]>(() => {
    const savedTeacher = loadTeacher()
    return savedTeacher ? loadClasses(savedTeacher.email) : []
  })
  const [activeClassId, setActiveClassId] = useState(() => {
    const savedTeacher = loadTeacher()
    const savedClasses = savedTeacher ? loadClasses(savedTeacher.email) : []
    return savedClasses[0]?.id ?? ''
  })
  const [className, setClassName] = useState('')
  const [studentDraft, setStudentDraft] = useState('')
  const [groupSize, setGroupSize] = useState(4)
  const [groupResult, setGroupResult] = useState<{ classId: string; groups: string[][] }>({
    classId: '',
    groups: [],
  })
  const [winnerResult, setWinnerResult] = useState<{ classId: string; name: string }>({
    classId: '',
    name: '',
  })
  const [spinRotation, setSpinRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [isGoogleReady, setIsGoogleReady] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const spinTimeoutRef = useRef<number | null>(null)
  const clientId = (import.meta.env as Record<string, string | undefined>).VITE_GOOGLE_CLIENT_ID?.trim()

  const activeClass = useMemo(
    () => classes.find((classroom) => classroom.id === activeClassId) ?? classes[0] ?? null,
    [activeClassId, classes],
  )
  const activeStudents = useMemo(() => activeClass?.students ?? [], [activeClass])
  const wheelBackground = useMemo(() => buildWheelBackground(activeStudents), [activeStudents])
  const visibleGroups =
    activeClass && groupResult.classId === activeClass.id ? groupResult.groups : []
  const visibleWinner =
    activeClass &&
    winnerResult.classId === activeClass.id &&
    activeStudents.includes(winnerResult.name)
      ? winnerResult.name
      : ''

  useEffect(() => {
    saveTeacher(teacher)
  }, [teacher])

  useEffect(() => {
    if (teacher) {
      saveClasses(teacher.email, classes)
    }
  }, [classes, teacher])

  useEffect(() => {
    if (!clientId || teacher) {
      return
    }

    let cancelled = false
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]')

    const renderGoogleButton = () => {
      if (cancelled || !window.google?.accounts.id || !googleButtonRef.current) {
        return
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }: GoogleCredentialResponse) => {
          try {
            if (!credential) {
              throw new Error('Google sign-in did not return a credential.')
            }

            const signedInTeacher = getTeacherFromCredential(credential)
            const savedClasses = loadClasses(signedInTeacher.email)

            setTeacher(signedInTeacher)
            setClasses(savedClasses)
            setActiveClassId(savedClasses[0]?.id ?? '')
            setGroupResult({ classId: '', groups: [] })
            setWinnerResult({ classId: '', name: '' })
            setAuthMessage('')
          } catch (error) {
            setAuthMessage(
              error instanceof Error ? error.message : 'Google sign-in was unable to finish.',
            )
          }
        },
      })

      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'filled_blue',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 280,
      })
      setIsGoogleReady(true)
    }

    const handleScriptError = () => {
      if (!cancelled) {
        setAuthMessage('Google sign-in could not be loaded. Please try again later.')
      }
    }

    if (existingScript) {
      existingScript.addEventListener('load', renderGoogleButton)
      existingScript.addEventListener('error', handleScriptError)
      renderGoogleButton()

      return () => {
        cancelled = true
        existingScript.removeEventListener('load', renderGoogleButton)
        existingScript.removeEventListener('error', handleScriptError)
      }
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.addEventListener('load', renderGoogleButton)
    script.addEventListener('error', handleScriptError)
    document.head.appendChild(script)

    return () => {
      cancelled = true
      script.removeEventListener('load', renderGoogleButton)
      script.removeEventListener('error', handleScriptError)
    }
  }, [clientId, teacher])

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) {
        window.clearTimeout(spinTimeoutRef.current)
      }
    }
  }, [])

  const createClassroom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = className.trim()

    if (!trimmedName) {
      return
    }

    const duplicate = classes.some(
      (classroom) => classroom.name.toLowerCase() === trimmedName.toLowerCase(),
    )

    if (duplicate) {
      setAuthMessage('That class already exists. Try a different class name.')
      return
    }

    const nextClassroom = {
      id: crypto.randomUUID(),
      name: trimmedName,
      students: [] as string[],
    }

    setClasses((current) => [...current, nextClassroom])
    setActiveClassId(nextClassroom.id)
    setGroupResult({ classId: '', groups: [] })
    setWinnerResult({ classId: '', name: '' })
    setClassName('')
    setAuthMessage('')
  }

  const addStudentsToActiveClass = () => {
    if (!activeClass) {
      return
    }

    const incomingStudents = splitStudentDraft(studentDraft)

    if (incomingStudents.length === 0) {
      return
    }

    setClasses((current) =>
      current.map((classroom) => {
        if (classroom.id !== activeClass.id) {
          return classroom
        }

        return {
          ...classroom,
          students: dedupeStudents([...classroom.students, ...incomingStudents]),
        }
      }),
    )
    setGroupResult({ classId: '', groups: [] })
    setWinnerResult({ classId: '', name: '' })
    setStudentDraft('')
  }

  const removeStudent = (student: string) => {
    if (!activeClass) {
      return
    }

    setClasses((current) =>
      current.map((classroom) => {
        if (classroom.id !== activeClass.id) {
          return classroom
        }

        return {
          ...classroom,
          students: classroom.students.filter((entry) => entry !== student),
        }
      }),
    )
    setGroupResult({ classId: '', groups: [] })
    setWinnerResult((current) =>
      current.name === student ? { classId: '', name: '' } : current,
    )
  }

  const deleteActiveClass = () => {
    if (!activeClass) {
      return
    }

    const shouldDelete = window.confirm(`Delete ${activeClass.name}? This will remove its saved roster.`)

    if (!shouldDelete) {
      return
    }

    const remainingClasses = classes.filter((classroom) => classroom.id !== activeClass.id)
    setClasses(remainingClasses)
    setActiveClassId(remainingClasses[0]?.id ?? '')
    setGroupResult({ classId: '', groups: [] })
    setWinnerResult({ classId: '', name: '' })
  }

  const loadSampleClassroom = () => {
    const existingSample = classes.find((classroom) => classroom.name === SAMPLE_CLASS_NAME)

    if (existingSample) {
      setActiveClassId(existingSample.id)
      setGroupResult({ classId: '', groups: [] })
      setWinnerResult({ classId: '', name: '' })
      return
    }

    const sampleClassroom = {
      id: crypto.randomUUID(),
      name: SAMPLE_CLASS_NAME,
      students: SAMPLE_STUDENTS,
    }

    setClasses((current) => [...current, sampleClassroom])
    setActiveClassId(sampleClassroom.id)
    setGroupResult({ classId: '', groups: [] })
    setWinnerResult({ classId: '', name: '' })
  }

  const spinWheel = () => {
    if (isSpinning || activeStudents.length === 0) {
      return
    }

    const winningIndex = Math.floor(Math.random() * activeStudents.length)
    const segmentSize = 360 / activeStudents.length
    const targetNormalised =
      (360 - (winningIndex * segmentSize + segmentSize / 2) + 360) % 360
    const currentNormalised = ((spinRotation % 360) + 360) % 360
    let delta = targetNormalised - currentNormalised

    if (delta < 0) {
      delta += 360
    }

    if (delta < 220) {
      delta += 360
    }

    setIsSpinning(true)
    setWinnerResult({ classId: '', name: '' })
    setSpinRotation((current) => current + 1800 + delta)

    if (spinTimeoutRef.current) {
      window.clearTimeout(spinTimeoutRef.current)
    }

    spinTimeoutRef.current = window.setTimeout(() => {
      setWinnerResult({
        classId: activeClass.id,
        name: activeStudents[winningIndex],
      })
      setIsSpinning(false)
    }, 4400)
  }

  const createGroups = () => {
    if (activeStudents.length === 0) {
      return
    }

    setGroupResult({
      classId: activeClass.id,
      groups: makeGroups(activeStudents, groupSize),
    })
  }

  const signOut = () => {
    window.google?.accounts.id.disableAutoSelect()
    setTeacher(null)
    setClasses([])
    setActiveClassId('')
    setGroupResult({ classId: '', groups: [] })
    setWinnerResult({ classId: '', name: '' })
    setStudentDraft('')
    setClassName('')
    setIsGoogleReady(false)
    setAuthMessage('')
  }

  const startDemo = () => {
    const demoTeacher = {
      name: 'Demo Teacher',
      email: 'demo@classroom.local',
    }

    setTeacher(demoTeacher)
    const savedClasses = loadClasses(demoTeacher.email)
    setClasses(savedClasses)
    setActiveClassId(savedClasses[0]?.id ?? '')
    setGroupResult({ classId: '', groups: [] })
    setWinnerResult({ classId: '', name: '' })
    setAuthMessage('')
  }

  return (
    <div className="app-shell">
      <header className="hero-banner">
        <div>
          <p className="eyebrow">Spark Classroom Picker</p>
          <h1>Bright, playful classroom picks for primary teachers.</h1>
          <p className="hero-copy">
            Save class rosters, spin the wheel for one learner, and build balanced random
            groups in a few cheerful taps.
          </p>
        </div>
        <div className="hero-badges" aria-label="Features">
          <span>Google sign-in</span>
          <span>Class lists</span>
          <span>Spin wheel</span>
          <span>Random groups</span>
        </div>
      </header>

      {!teacher ? (
        <main className="landing-layout">
          <section className="feature-grid" aria-label="Classroom features">
            <article className="feature-card">
              <span className="feature-icon">🎡</span>
              <h2>Spin for a single learner</h2>
              <p>Choose one child in a fun, fair way that feels special during carpet time.</p>
            </article>
            <article className="feature-card">
              <span className="feature-icon">🧩</span>
              <h2>Mix groups in seconds</h2>
              <p>Pick a group size and remix teams any time you need quick partner or table work.</p>
            </article>
            <article className="feature-card">
              <span className="feature-icon">📚</span>
              <h2>Keep every class tidy</h2>
              <p>Save separate class lists so every roster is ready for the next lesson.</p>
            </article>
          </section>

          <section className="auth-card" aria-label="Teacher sign in">
            <div>
              <p className="eyebrow">Teacher access</p>
              <h2>Welcome back.</h2>
              <p>
                Sign in with Google to keep each class list linked to your teacher account on
                this device.
              </p>
            </div>

            {clientId ? (
              <>
                <div className="google-button-slot" ref={googleButtonRef} />
                {!isGoogleReady && !authMessage ? (
                  <p className="helper-copy">Loading Google sign-in…</p>
                ) : null}
              </>
            ) : (
              <div className="setup-card">
                <p>
                  Add a Google client ID to <code>.env.local</code> to enable live sign-in.
                </p>
                <p className="helper-copy">
                  Use the included <code>.env.example</code> as a starting point.
                </p>
              </div>
            )}

            <button type="button" className="secondary-button" onClick={startDemo}>
              Try demo mode
            </button>

            {authMessage ? <p className="status-message">{authMessage}</p> : null}
          </section>
        </main>
      ) : (
        <main className="dashboard-layout">
          <aside className="sidebar-card">
            <div className="teacher-card">
              {teacher.picture ? (
                <img src={teacher.picture} alt="Teacher avatar" className="teacher-avatar" />
              ) : (
                <div className="teacher-avatar teacher-avatar--fallback" aria-hidden="true">
                  {teacher.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="eyebrow">Signed in</p>
                <strong>{teacher.name}</strong>
                <p className="helper-copy">{teacher.email}</p>
              </div>
            </div>

            <form className="panel-card add-class-form" onSubmit={createClassroom}>
              <label className="field-label" htmlFor="class-name">
                New class name
              </label>
              <input
                id="class-name"
                className="text-input"
                type="text"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                placeholder="e.g. Robins"
              />
              <button type="submit" className="primary-button">
                Add class list
              </button>
              {authMessage ? <p className="status-message">{authMessage}</p> : null}
            </form>

            <section className="panel-card class-list-panel" aria-label="Saved classes">
              <div className="section-heading">
                <h2>Your classes</h2>
                <button type="button" className="link-button" onClick={loadSampleClassroom}>
                  Load sample
                </button>
              </div>
              {classes.length === 0 ? (
                <p className="helper-copy">Create your first class to start spinning and grouping.</p>
              ) : (
                <div className="class-list">
                  {classes.map((classroom) => (
                    <button
                      key={classroom.id}
                      type="button"
                      className={`class-list-item${classroom.id === activeClassId ? ' is-active' : ''}`}
                      onClick={() => setActiveClassId(classroom.id)}
                    >
                      <span>{classroom.name}</span>
                      <small>{classroom.students.length} pupils</small>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <button type="button" className="ghost-button" onClick={signOut}>
              Sign out
            </button>
          </aside>

          <section className="workspace">
            {activeClass ? (
              <>
                <section className="panel-card workspace-header">
                  <div>
                    <p className="eyebrow">Active class</p>
                    <h2>{activeClass.name}</h2>
                    <p>{activeStudents.length} children ready for lessons, routines, and games.</p>
                  </div>
                  <button type="button" className="danger-button" onClick={deleteActiveClass}>
                    Delete class
                  </button>
                </section>

                <section className="panel-grid panel-grid--two-up">
                  <article className="panel-card">
                    <div className="section-heading">
                      <h2>Class list</h2>
                      <span className="pill-badge">Saved automatically</span>
                    </div>
                    <p className="helper-copy">
                      Paste one child per line or separate names with commas.
                    </p>
                    <textarea
                      className="text-area"
                      value={studentDraft}
                      onChange={(event) => setStudentDraft(event.target.value)}
                      placeholder="Ava\nMason\nRuby"
                      rows={5}
                    />
                    <button type="button" className="primary-button" onClick={addStudentsToActiveClass}>
                      Add learners
                    </button>
                    <div className="student-chip-list" aria-label="Learners in class">
                      {activeStudents.map((student) => (
                        <button
                          key={student}
                          type="button"
                          className="student-chip"
                          onClick={() => removeStudent(student)}
                          title={`Remove ${student}`}
                        >
                          <span>{student}</span>
                          <strong aria-hidden="true">×</strong>
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className="panel-card wheel-panel">
                    <div className="section-heading">
                      <h2>Spin the wheel</h2>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={spinWheel}
                        disabled={isSpinning || activeStudents.length === 0}
                      >
                        {isSpinning ? 'Spinning…' : 'Spin now'}
                      </button>
                    </div>
                    <div className="wheel-wrap">
                      <div className="wheel-pointer" aria-hidden="true" />
                      <div
                        className="wheel"
                        style={{
                          background: wheelBackground,
                          transform: `rotate(${spinRotation}deg)`,
                        }}
                        aria-label="Random learner wheel"
                      >
                        {activeStudents.length === 0 ? (
                          <div className="wheel-empty">Add learners to begin</div>
                        ) : (
                          activeStudents.map((student, index) => {
                            const angle = (360 / activeStudents.length) * index + 360 / activeStudents.length / 2

                            return (
                              <div
                                key={student}
                                className="wheel-marker"
                                style={{ transform: `rotate(${angle}deg) translateY(calc(-1 * var(--wheel-marker-offset)))` }}
                              >
                                <span style={{ transform: `rotate(${-angle}deg)` }}>{index + 1}</span>
                              </div>
                            )
                          })
                        )}
                        <div className="wheel-centre">Pick</div>
                      </div>
                    </div>
                    <div className="wheel-results">
                      <div className="winner-card">
                        <p className="eyebrow">Chosen learner</p>
                        <strong>{visibleWinner || 'Spin to reveal a name'}</strong>
                      </div>
                      <ol className="wheel-legend">
                        {activeStudents.map((student, index) => (
                          <li key={student}>
                            <span
                              className="legend-swatch"
                              style={{ backgroundColor: WHEEL_COLORS[index % WHEEL_COLORS.length] }}
                              aria-hidden="true"
                            />
                            <span>{index + 1}.</span>
                            <span>{student}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </article>
                </section>

                <section className="panel-card group-panel">
                  <div className="section-heading group-panel__heading">
                    <div>
                      <h2>Random groups</h2>
                      <p className="helper-copy">
                        Choose how many learners should be in each group, then remix any time.
                      </p>
                    </div>
                    <div className="group-controls">
                      <label className="field-label" htmlFor="group-size">
                        Learners per group
                      </label>
                      <input
                        id="group-size"
                        className="number-input"
                        type="number"
                        min={2}
                        max={Math.max(2, activeStudents.length || 2)}
                        value={groupSize}
                        onChange={(event) => setGroupSize(Number(event.target.value) || 2)}
                      />
                      <button
                        type="button"
                        className="primary-button"
                        onClick={createGroups}
                        disabled={activeStudents.length === 0}
                      >
                        {visibleGroups.length > 0 ? 'Remix groups' : 'Create groups'}
                      </button>
                    </div>
                  </div>

                  {visibleGroups.length === 0 ? (
                    <div className="empty-state">
                      <p>Groups will appear here after you create them.</p>
                    </div>
                  ) : (
                    <div className="group-grid">
                      {visibleGroups.map((group, index) => (
                        <article key={`${group.join('-')}-${index}`} className="group-card">
                          <p className="eyebrow">{GROUP_TITLES[index % GROUP_TITLES.length]} group</p>
                          <h3>Group {index + 1}</h3>
                          <ul>
                            {group.map((student) => (
                              <li key={student}>{student}</li>
                            ))}
                          </ul>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <section className="panel-card empty-workspace">
                <h2>Start your first class list.</h2>
                <p>
                  Add a class in the left panel, or load the sample roster to explore the wheel and
                  random groups.
                </p>
                <button type="button" className="primary-button" onClick={loadSampleClassroom}>
                  Load sample classroom
                </button>
              </section>
            )}
          </section>
        </main>
      )}
    </div>
  )
}

export default App
