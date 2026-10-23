import { useEffect, useRef, useState } from 'react'
import './App.css'

type Settings = {
  primary: string
  secondary: string
  density: number
  size: number
  intensity: number
  smoothness: number
  speed: number
  gradientRadius: number
}

type Palette = {
  primary: string
  secondary: string
}

const palettes: Palette[] = [
  { primary: '#f5309d', secondary: '#f8d3e8' },
  { primary: '#7357e8', secondary: '#c8ecff' },
  { primary: '#ff795c', secondary: '#ffe7a8' },
  { primary: '#18a88f', secondary: '#d2f5db' },
]

type Particle = {
  x: number
  y: number
  baseX: number
  baseY: number
  radius: number
  phase: number
  seed: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const withAlpha = (color: string, alpha: number) =>
  color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)

const sanitizeHex = (value: string) => {
  const trimmed = value.trim()
  if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed)) {
    return '#ffffff'
  }

  if (trimmed.length === 4) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((char) => char + char)
      .join('')}`
  }

  return trimmed
}

const colorToRgb = (color: string): [number, number, number] => {
  const rgbMatch = color.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+\s*)?\)$/,
  )
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]
  }

  const clean = sanitizeHex(color).replace('#', '')
  const normalized = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
  const parsed = Number.parseInt(normalized, 16)

  return [
    (parsed >> 16) & 255,
    (parsed >> 8) & 255,
    parsed & 255,
  ]
}

const mix = (a: string, b: string, amount: number): string => {
  const from = colorToRgb(a)
  const to = colorToRgb(b)
  const t = clamp(amount, 0, 1)

  const mixed = from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * t),
  ) as [number, number, number]

  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`
}

const createParticles = (width: number, height: number, density: number): Particle[] => {
  let spacing = clamp(48 / Math.sqrt(density), 34, 64)
  let columns = Math.ceil(width / spacing) + 2
  let rows = Math.ceil(height / spacing) + 2
  const count = columns * rows

  if (count > 1800) {
    spacing *= Math.sqrt(count / 1800)
    columns = Math.ceil(width / spacing) + 2
    rows = Math.ceil(height / spacing) + 2
  }

  return Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const baseX = (column - 1) * spacing + (row % 2) * spacing * 0.5
    const baseY = (row - 1) * spacing

    return {
      x: baseX,
      y: baseY,
      baseX: baseX + (Math.random() - 0.5) * spacing * 0.06,
      baseY: baseY + (Math.random() - 0.5) * spacing * 0.06,
      radius: spacing * (0.5 + Math.random() * 0.015),
      phase: Math.random() * Math.PI * 2,
      seed: Math.random() * 1000,
    }
  })
}

const defaultSettings: Settings = {
  primary: '#f5309d',
  secondary: '#f8d3e8',
  density: 1,
  size: 1.15,
  intensity: 1.1,
  smoothness: 0.7,
  speed: 0.9,
  gradientRadius: 290,
}

const getParticleColor = (
  particle: Particle,
  settings: Settings,
  pointerX: number,
  pointerY: number,
  pointerActive: boolean,
) => {
  const distanceFromPointer = Math.hypot(particle.x - pointerX, particle.y - pointerY)
  const interactionRadius = settings.gradientRadius
  const distanceRatio = clamp(distanceFromPointer / interactionRadius, 0, 1)
  const falloff = 1 - distanceRatio * distanceRatio * (3 - 2 * distanceRatio)
  const pointerEnergy = pointerActive ? falloff : 0
  const gradientColor = mix(settings.primary, settings.secondary, distanceRatio)
  return mix('#ffffff', gradientColor, pointerEnergy * 0.96)
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pointerRef = useRef({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    lastInteractionAt: 0,
    active: false,
  })
  const particlesRef = useRef<Particle[]>([])
  const settingsRef = useRef<Settings>(defaultSettings)
  const paletteIndexRef = useRef(0)
  const colorTransitionRef = useRef({
    primary: defaultSettings.primary,
    secondary: defaultSettings.secondary,
    targetPrimary: defaultSettings.primary,
    targetSecondary: defaultSettings.secondary,
    startedAt: 0,
  })
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastSoundRef = useRef({ x: 0, y: 0, time: 0 })
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isUiVisible, setIsUiVisible] = useState(true)
  const [autoPalette, setAutoPalette] = useState(false)
  const [paletteInterval, setPaletteInterval] = useState<3 | 5>(5)
  const [bubbleSoundEnabled, setBubbleSoundEnabled] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'u') {
        event.preventDefault()
        setIsUiVisible((visible) => !visible)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return undefined
    }

    const handleResize = () => {
      const ratio = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * ratio))
      canvas.height = Math.max(1, Math.floor(rect.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      const width = rect.width || window.innerWidth
      const height = rect.height || window.innerHeight
      particlesRef.current = createParticles(width, height, settingsRef.current.density)
      pointerRef.current.targetX = width * 0.5
      pointerRef.current.targetY = height * 0.5
      pointerRef.current.x = pointerRef.current.targetX
      pointerRef.current.y = pointerRef.current.targetY
      pointerRef.current.lastInteractionAt = performance.now()
    }

    let animationFrameId = 0
    let previousFrameTime = 0

    const renderFrame = (time: number) => {
      const width = canvas.clientWidth || window.innerWidth
      const height = canvas.clientHeight || window.innerHeight
      const settingsNow = settingsRef.current
      const pointer = pointerRef.current
      const deltaTime =
        previousFrameTime === 0 ? 16.67 : Math.min(time - previousFrameTime, 50)
      previousFrameTime = time
      const pointerEasing = 1 - Math.exp(-deltaTime / 95)
      const particleEasing = 1 - Math.exp(-deltaTime / 125)

      const transition = colorTransitionRef.current
      if (
        transition.targetPrimary !== settingsNow.primary ||
        transition.targetSecondary !== settingsNow.secondary
      ) {
        transition.primary = mix(
          transition.primary,
          transition.targetPrimary,
          clamp((time - transition.startedAt) / 900, 0, 1),
        )
        transition.secondary = mix(
          transition.secondary,
          transition.targetSecondary,
          clamp((time - transition.startedAt) / 900, 0, 1),
        )
        transition.targetPrimary = settingsNow.primary
        transition.targetSecondary = settingsNow.secondary
        transition.startedAt = time
      }

      const transitionProgress = clamp((time - transition.startedAt) / 900, 0, 1)
      const easedTransition = transitionProgress * transitionProgress * (3 - 2 * transitionProgress)
      transition.primary = mix(
        transition.primary,
        transition.targetPrimary,
        easedTransition,
      )
      transition.secondary = mix(
        transition.secondary,
        transition.targetSecondary,
        easedTransition,
      )
      const current: Settings = {
        ...settingsNow,
        primary: transition.primary,
        secondary: transition.secondary,
      }

      const idleDuration = time - pointer.lastInteractionAt
      if (idleDuration > 1600) {
        const idleTime = idleDuration - 1600
        pointer.targetX =
          width * 0.5 +
          Math.sin(idleTime * 0.00032) * width * 0.31 +
          Math.sin(idleTime * 0.00017) * width * 0.08
        pointer.targetY =
          height * 0.5 +
          Math.cos(idleTime * 0.00026) * height * 0.28 +
          Math.sin(idleTime * 0.00013) * height * 0.07
        pointer.active = true
      }

      pointer.x += (pointer.targetX - pointer.x) * pointerEasing
      pointer.y += (pointer.targetY - pointer.y) * pointerEasing

      context.clearRect(0, 0, width, height)
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)

      particlesRef.current.forEach((particle) => {
        const distanceX = particle.baseX - pointer.x
        const distanceY = particle.baseY - pointer.y
        const distanceFromPointer = Math.hypot(distanceX, distanceY)
        const interactionRadius = current.gradientRadius
        const pointerEnergy = pointer.active
          ? 1 - clamp(distanceFromPointer / interactionRadius, 0, 1)
          : 0
        const displacement = pointerEnergy * pointerEnergy * current.intensity * 7
        const targetX =
          particle.baseX +
          Math.cos(time * 0.00045 * current.speed + particle.phase) * 1.6 +
          (distanceX / Math.max(distanceFromPointer, 1)) * displacement
        const targetY =
          particle.baseY +
          Math.sin(time * 0.0004 * current.speed + particle.seed) * 1.6 +
          (distanceY / Math.max(distanceFromPointer, 1)) * displacement

        particle.x += (targetX - particle.x) * particleEasing
        particle.y += (targetY - particle.y) * particleEasing

        const radius = particle.radius * current.size
        const color = getParticleColor(
          particle,
          current,
          pointer.x,
          pointer.y,
          pointer.active,
        )

        const lightAngle = -Math.PI / 4
        const highlightX = particle.x + Math.cos(lightAngle) * radius * 0.38
        const highlightY = particle.y + Math.sin(lightAngle) * radius * 0.38
        const glass = context.createRadialGradient(
          highlightX - radius * 0.16,
          highlightY - radius * 0.2,
          radius * 0.03,
          particle.x,
          particle.y,
          radius * 1.12,
        )
        glass.addColorStop(0, withAlpha(mix(color, '#ffffff', 0.3), 0.92))
        glass.addColorStop(0.2, withAlpha(color, 0.94))
        glass.addColorStop(0.72, withAlpha(color, 0.88))
        glass.addColorStop(0.94, withAlpha(mix(color, '#ded8e0', 0.42), 0.92))
        glass.addColorStop(1, 'rgba(215,208,220,0.72)')

        context.save()
        context.shadowColor = 'rgba(47, 30, 52, 0.16)'
        context.shadowBlur = radius * 0.38
        context.shadowOffsetX = radius * 0.06
        context.shadowOffsetY = radius * 0.1
        context.beginPath()
        context.fillStyle = glass
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
        context.fill()
        context.restore()

        const rim = context.createLinearGradient(
          particle.x - radius,
          particle.y - radius,
          particle.x + radius,
          particle.y + radius,
        )
        rim.addColorStop(0, `rgba(255,248,255,${0.28 + pointerEnergy * 0.2})`)
        rim.addColorStop(0.48, 'rgba(255,255,255,0.42)')
        rim.addColorStop(1, 'rgba(88,65,96,0.34)')
        context.beginPath()
        context.strokeStyle = rim
        context.lineWidth = Math.max(0.8, radius * 0.085)
        context.arc(particle.x, particle.y, radius * 0.94, 0, Math.PI * 2)
        context.stroke()

        context.beginPath()
        context.strokeStyle = `rgba(255,250,255,${0.15 + pointerEnergy * 0.22})`
        context.lineWidth = Math.max(0.7, radius * 0.055)
        context.arc(
          particle.x - radius * 0.025,
          particle.y - radius * 0.025,
          radius * 0.76,
          lightAngle - 2.1,
          lightAngle - 0.45,
        )
        context.stroke()

        const specular = context.createRadialGradient(
          highlightX - radius * 0.12,
          highlightY - radius * 0.14,
          0,
          highlightX - radius * 0.12,
          highlightY - radius * 0.14,
          radius * 0.38,
        )
        specular.addColorStop(0, `rgba(255,255,255,${0.14 + pointerEnergy * 0.2})`)
        specular.addColorStop(1, 'rgba(255,255,255,0)')
        context.beginPath()
        context.fillStyle = specular
        context.arc(
          highlightX - radius * 0.12,
          highlightY - radius * 0.14,
          radius * 0.38,
          0,
          Math.PI * 2,
        )
        context.fill()
      })

      animationFrameId = requestAnimationFrame(renderFrame)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    animationFrameId = requestAnimationFrame(renderFrame)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  useEffect(() => {
    if (!autoPalette) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      paletteIndexRef.current = (paletteIndexRef.current + 1) % palettes.length
      const nextPalette = palettes[paletteIndexRef.current]
      setSettings((previous) => ({
        ...previous,
        primary: nextPalette.primary,
        secondary: nextPalette.secondary,
      }))
    }, paletteInterval * 1000)

    return () => window.clearInterval(intervalId)
  }, [autoPalette, paletteInterval])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const { width, height } = canvas.getBoundingClientRect()
    particlesRef.current = createParticles(
      width || window.innerWidth,
      height || window.innerHeight,
      settings.density,
    )
  }, [settings.density])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const updateSetting = <Key extends keyof Settings>(key: Key, value: Settings[Key]) => {
    setSettings((previous) => ({ ...previous, [key]: value }))
  }

  const handlePointer = (clientX: number, clientY: number, rect: DOMRect) => {
    const normalizedX = clamp(clientX - rect.left, 0, rect.width)
    const normalizedY = clamp(clientY - rect.top, 0, rect.height)
    const now = performance.now()
    const lastSound = lastSoundRef.current
    const distanceSinceSound = Math.hypot(
      normalizedX - lastSound.x,
      normalizedY - lastSound.y,
    )

    if (
      bubbleSoundEnabled &&
      distanceSinceSound >= 34 &&
      now - lastSound.time >= 180 &&
      typeof window.AudioContext !== 'undefined'
    ) {
      const audioContext =
        audioContextRef.current ??
        (audioContextRef.current = new window.AudioContext())
      void audioContext.resume()

      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      const startTime = audioContext.currentTime
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(620, startTime)
      oscillator.frequency.exponentialRampToValueAtTime(245, startTime + 0.16)
      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.exponentialRampToValueAtTime(0.045, startTime + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.19)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(startTime)
      oscillator.stop(startTime + 0.2)
      lastSoundRef.current = { x: normalizedX, y: normalizedY, time: now }
    }

    pointerRef.current.targetX = normalizedX
    pointerRef.current.targetY = normalizedY
    pointerRef.current.lastInteractionAt = performance.now()
    pointerRef.current.active = true
  }

  const resetCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const rect = canvas.getBoundingClientRect()
    const width = rect.width || window.innerWidth
    const height = rect.height || window.innerHeight
    pointerRef.current.targetX = width * 0.5
    pointerRef.current.targetY = height * 0.5
    pointerRef.current.x = width * 0.5
    pointerRef.current.y = height * 0.5
    pointerRef.current.lastInteractionAt = performance.now()
    pointerRef.current.active = false
    particlesRef.current = createParticles(width, height, settingsRef.current.density)
  }

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      return
    }

    await document.exitFullscreen()
  }

  const handleSaveFrame = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'chroma-glass-frame.png'
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const startRecording = () => {
    const canvas = canvasRef.current
    if (!canvas || typeof MediaRecorder === 'undefined') {
      return
    }

    const stream = canvas.captureStream(30)
    const mimeType =
      MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    recordedChunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data)
      }
    }
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType })
      const nextUrl = URL.createObjectURL(blob)
      setVideoUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl)
        }
        return nextUrl
      })
    }

    mediaRecorderRef.current = recorder
    recorder.start(250)
    setIsRecording(true)
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) {
      return
    }

    recorder.stop()
    setIsRecording(false)
  }

  return (
    <div className="app-shell">
      {isUiVisible ? (
        <>
      <header className="topbar glass-panel">
        <div className="brand-block">
          <span className="brand-name">CHROMA GLASS</span>
          <span className="brand-subtitle">INTERACTIVE MOTION STUDIO</span>
        </div>

        <div className="toolbar-actions">
          <button type="button" className="toolbar-button" onClick={resetCanvas}>
            Reset canvas
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => setIsSettingsOpen((open) => !open)}
          >
            Settings
          </button>
          <button type="button" className="toolbar-button" onClick={toggleFullscreen}>
            {isFullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      </header>

      <aside className={`control-panel glass-panel ${isSettingsOpen ? 'open' : 'collapsed'}`}>
        <div className="panel-header">
          <span>Color Studio</span>
          <button type="button" className="mini-button" onClick={() => setIsSettingsOpen((open) => !open)}>
            {isSettingsOpen ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="control-group">
          <div className="color-row">
            <label>Primary</label>
            <span className="color-badge" style={{ background: settings.primary }} />
            <input type="color" value={settings.primary} onChange={(event) => updateSetting('primary', event.target.value)} />
            <input
              type="text"
              value={settings.primary}
              onChange={(event) => updateSetting('primary', sanitizeHex(event.target.value))}
            />
          </div>

          <div className="color-row">
            <label>Secondary</label>
            <span className="color-badge" style={{ background: settings.secondary }} />
            <input type="color" value={settings.secondary} onChange={(event) => updateSetting('secondary', event.target.value)} />
            <input
              type="text"
              value={settings.secondary}
              onChange={(event) => updateSetting('secondary', sanitizeHex(event.target.value))}
            />
          </div>

          <button
            type="button"
            className="swap-button"
            onClick={() =>
              setSettings((previous) => ({
                ...previous,
                primary: previous.secondary,
                secondary: previous.primary,
              }))
            }
          >
            Swap colors
          </button>
        </div>

        <div className="palette-settings">
          <label className="palette-toggle">
            <input
              type="checkbox"
              checked={autoPalette}
              onChange={(event) => setAutoPalette(event.target.checked)}
            />
            <span>Auto color flow</span>
          </label>
          <label className="palette-interval">
            <span>Change every</span>
            <select
              aria-label="Color change interval"
              value={paletteInterval}
              onChange={(event) => setPaletteInterval(Number(event.target.value) as 3 | 5)}
              disabled={!autoPalette}
            >
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
            </select>
          </label>
        </div>

        <label className="sound-toggle">
          <input
            type="checkbox"
            checked={bubbleSoundEnabled}
            onChange={(event) => setBubbleSoundEnabled(event.target.checked)}
          />
          <span>Bubble sound</span>
        </label>

        <div className="control-group compact-group">
          <label className="range-label" htmlFor="density">
            Density <span>{settings.density.toFixed(1)}</span>
          </label>
          <input id="density" type="range" min="0.5" max="1.8" step="0.1" value={settings.density} onChange={(event) => updateSetting('density', Number(event.target.value))} />

          <label className="range-label" htmlFor="size">
            Size <span>{settings.size.toFixed(1)}</span>
          </label>
          <input id="size" type="range" min="0.6" max="1.8" step="0.1" value={settings.size} onChange={(event) => updateSetting('size', Number(event.target.value))} />

          <label className="range-label" htmlFor="intensity">
            Intensity <span>{settings.intensity.toFixed(1)}</span>
          </label>
          <input id="intensity" type="range" min="0.6" max="1.8" step="0.1" value={settings.intensity} onChange={(event) => updateSetting('intensity', Number(event.target.value))} />

          <label className="range-label" htmlFor="smoothness">
            Smoothness <span>{settings.smoothness.toFixed(1)}</span>
          </label>
          <input id="smoothness" type="range" min="0.3" max="1.2" step="0.1" value={settings.smoothness} onChange={(event) => updateSetting('smoothness', Number(event.target.value))} />

          <label className="range-label" htmlFor="speed">
            Speed <span>{settings.speed.toFixed(1)}</span>
          </label>
          <input id="speed" type="range" min="0.3" max="1.6" step="0.1" value={settings.speed} onChange={(event) => updateSetting('speed', Number(event.target.value))} />

          <label className="range-label" htmlFor="gradient-radius">
            Color radius <span>{settings.gradientRadius}px</span>
          </label>
          <input
            id="gradient-radius"
            type="range"
            min="100"
            max="600"
            step="10"
            value={settings.gradientRadius}
            onChange={(event) => updateSetting('gradientRadius', Number(event.target.value))}
          />
        </div>

      </aside>
        </>
      ) : null}

      <main className="studio-surface">
        <canvas
          ref={canvasRef}
          className="art-canvas"
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            handlePointer(event.clientX, event.clientY, rect)
          }}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            handlePointer(event.clientX, event.clientY, rect)
          }}
          onPointerLeave={() => {
            pointerRef.current.active = false
          }}
        />

        {isUiVisible ? (
          <>
            <div className="floating-actions">
              <button type="button" className="primary-action" onClick={isRecording ? stopRecording : startRecording}>
                {isRecording ? 'Stop recording' : 'Start recording'}
              </button>
              <button type="button" className="secondary-action" onClick={handleSaveFrame}>
                Capture frame
              </button>
            </div>

            {videoUrl ? (
              <div className="preview-panel glass-panel">
                <span className="preview-label">Preview</span>
                <video src={videoUrl} controls playsInline muted />
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  )
}

export default App
