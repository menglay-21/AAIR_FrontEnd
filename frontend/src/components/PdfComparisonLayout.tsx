import { useMemo, type ReactNode } from 'react'
import { ResizableSplitPane } from './ResizableSplitPane'
import styles from './ResizableSplitPane.module.css'

type PdfComparisonLayoutProps = {
  pdfUrl: string
  dataPanel: ReactNode
  documentTitle?: string
  className?: string
}

export function withDefaultPdfView(pdfUrl: string) {
  const file = encodeURIComponent(pdfUrl.split('#', 1)[0])
  return `/resource/pdfjs/viewer.html?file=${file}#page=1&zoom=100`
}

export function PdfComparisonLayout({
  pdfUrl,
  dataPanel,
  documentTitle = 'Financial document',
  className,
}: PdfComparisonLayoutProps) {
  const iframeSrc = useMemo(() => withDefaultPdfView(pdfUrl), [pdfUrl])

  const pdfPanel = (
    <div className={styles.pdfViewport}>
      <iframe
        key={iframeSrc}
        className={styles.pdfFrame}
        src={iframeSrc}
        title={documentTitle}
      />
    </div>
  )

  return (
    <ResizableSplitPane
      className={className}
      defaultLeftWidth={58}
      leftPanel={pdfPanel}
      maxWidth={80}
      minWidth={30}
      rightPanel={dataPanel}
      storageKey="pdf-split-width"
    />
  )
}
