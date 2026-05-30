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
