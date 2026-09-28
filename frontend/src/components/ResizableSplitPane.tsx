import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import styles from './ResizableSplitPane.module.css'

type ResizableSplitPaneProps = {
  leftPanel: ReactNode
  rightPanel: ReactNode
  defaultLeftWidth?: number
  minWidth?: number
  maxWidth?: number
  keyboardStep?: number
  storageKey?: string
  className?: string
}

type SplitPaneStyle = CSSProperties & {
  '--left-width': string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function readStoredWidth(storageKey: string, fallback: number, min: number, max: number) {
  if (typeof window === 'undefined') return clamp(fallback, min, max)

  try {
    const stored = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(stored) && stored > 0
      ? clamp(stored, min, max)
      : clamp(fallback, min, max)
  } catch {
    return clamp(fallback, min, max)
  }
}

export function ResizableSplitPane({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 58,
  minWidth = 30,
  maxWidth = 80,
  keyboardStep = 2,
  storageKey = 'pdf-split-width',
  className = '',
}: ResizableSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activePointerRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [leftWidth, setLeftWidth] = useState(() =>
    readStoredWidth(storageKey, defaultLeftWidth, minWidth, maxWidth),
  )
  const leftWidthRef = useRef(leftWidth)

  const updateWidth = useCallback((nextWidth: number) => {
    const next = clamp(nextWidth, minWidth, maxWidth)
    leftWidthRef.current = next

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
    }
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setLeftWidth(next)
      animationFrameRef.current = null
    })
  }, [maxWidth, minWidth])

  const persistWidth = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, String(leftWidthRef.current))
    } catch {
      // The pane still works when storage is unavailable.
    }
  }, [storageKey])

  const updateFromPointer = useCallback((clientX: number) => {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds?.width) return
    updateWidth(((clientX - bounds.left) / bounds.width) * 100)
  }, [updateWidth])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    activePointerRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    updateFromPointer(event.clientX)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return
    updateFromPointer(event.clientX)
  }

  const finishDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    activePointerRef.current = null
    setIsDragging(false)
    persistWidth()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    const next = clamp(leftWidthRef.current + direction * keyboardStep, minWidth, maxWidth)
    updateWidth(next)
    try {
      window.localStorage.setItem(storageKey, String(next))
    } catch {
      // The pane still works when storage is unavailable.
    }
  }

  useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  const splitPaneStyle: SplitPaneStyle = { '--left-width': `${leftWidth}%` }
  const rootClassName = [styles.splitPane, isDragging ? styles.dragging : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={containerRef} className={rootClassName} style={splitPaneStyle}>
      <section className={`${styles.panel} ${styles.leftPanel}`}>{leftPanel}</section>

      <div
        aria-label="Resize PDF panel"
        aria-orientation="vertical"
        aria-valuemax={maxWidth}
        aria-valuemin={minWidth}
        aria-valuenow={Math.round(leftWidth)}
        aria-valuetext={`${Math.round(leftWidth)}%`}
        className={styles.splitter}
        onKeyDown={handleKeyDown}
        onPointerCancel={finishDragging}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDragging}
        role="separator"
        tabIndex={0}
        title="Drag to resize the PDF panel"
      />

      <section className={`${styles.panel} ${styles.rightPanel}`}>{rightPanel}</section>
    </div>
  )
}

