import { useCallback, useState } from 'react'

export const DEFAULT_SECTIONS = [
  'Overview',
  'Process Steps',
  'Key Observations',
  'Technical Notes',
  'Expected Output',
]

function extractHeadings(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html')
  const seen = new Set()
  return Array.from(doc.querySelectorAll('h1,h2,h3'))
    .map(h => h.textContent.trim())
    .filter(t => t.length > 1 && t.length < 80 && !seen.has(t) && seen.add(t))
    .slice(0, 10)
}

// Full plain-text extraction from a document (for Doc Chat).
export async function extractText(file) {
  const name = file.name.toLowerCase()
  if (/\.(txt|md|csv|json)$/.test(name)) return await file.text()
  if (/\.html?$/.test(name)) {
    const html = await file.text()
    return new DOMParser().parseFromString(html, 'text/html').body?.textContent?.trim() || ''
  }
  if (/\.docx$/.test(name)) {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.default.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return value || ''
  }
  throw new Error('Unsupported file. Use .txt, .md, .html or .docx (PDF support coming soon).')
}

// Chunk long documents into overlapping passages so big docs index cleanly for RAG.
export function chunkText(text, size = 900, overlap = 120) {
  const clean = (text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  // prefer paragraph boundaries, then pack to ~size with a little overlap
  const paras = clean.split(/\n\s*\n/)
  const chunks = []
  let buf = ''
  for (const p of paras) {
    if ((buf + '\n\n' + p).length > size && buf) {
      chunks.push(buf.trim())
      buf = buf.slice(Math.max(0, buf.length - overlap)) + '\n\n' + p
    } else {
      buf = buf ? buf + '\n\n' + p : p
    }
    while (buf.length > size * 1.6) {
      chunks.push(buf.slice(0, size).trim())
      buf = buf.slice(size - overlap)
    }
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks.filter(c => c.length > 20)
}

export default function useDocParser() {
  const [sections, setSections] = useState([])
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState(null)

  const parseDoc = useCallback(async (file) => {
    setParsing(true)
    setParseError(null)
    try {
      let headings = []

      if (/\.html?$/i.test(file.name)) {
        const text = await file.text()
        headings = extractHeadings(text)
      } else if (/\.docx$/i.test(file.name)) {
        const mammoth = await import('mammoth')
        const buf = await file.arrayBuffer()
        const { value } = await mammoth.default.convertToHtml({ arrayBuffer: buf })
        headings = extractHeadings(value)
      } else {
        setParseError('Only .html and .docx files are supported')
        setParsing(false)
        return DEFAULT_SECTIONS
      }

      const result = headings.length >= 2 ? headings : DEFAULT_SECTIONS
      setSections(result)
      setParsing(false)
      return result
    } catch (e) {
      setParseError(e.message)
      setSections(DEFAULT_SECTIONS)
      setParsing(false)
      return DEFAULT_SECTIONS
    }
  }, [])

  return { parseDoc, sections, parsing, parseError }
}
