import { buildContextPrompt, parseStepsAnnotation, groupIntoWindows } from './src/lib/skillPrompt.js'
import { detectTools } from './src/hooks/useOCR.js'
import { chunkText } from './src/hooks/useDocParser.js'

let pass = 0, fail = 0
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? '✓' : '✗ FAIL'}  ${n}`) }

// ── skillPrompt ──
ok('empty narration prompt', /no narration/i.test(buildContextPrompt('', '01:00', null, null, 'Excel')))
ok('spoken prompt has text', /click/.test(buildContextPrompt('click X', '00:05', null, null, '')))
const ps = parseStepsAnnotation('STEPS:\n1. Open\n2. Save\nRESULT: done')
ok('parseSteps 2 steps + result', ps?.steps.length === 2 && ps.result === 'done')
ok('groupIntoWindows >1', groupIntoWindows(Array.from({length:30},(_,i)=>({text:'x',timestamp:[i*4,i*4+4]})),45).length >= 2)

// ── tools ──
const t = detectTools('Excel Book2.xlsx Alt+F11 End Sub python def foo()')
ok('tools Excel+VBA+Python', t.includes('Microsoft Excel') && t.includes('VBA / Macros') && t.includes('Python'))
ok('no tools on plain text', detectTools('the quick brown fox').length === 0)

// ── doc chunking (Doc Chat, big docs) ──
const big = Array.from({length:60}, (_,i)=>`Paragraph ${i}. `+'word '.repeat(40)).join('\n\n')
const ch = chunkText(big, 900, 120)
ok(`chunkText splits big doc -> ${ch.length} chunks (>1)`, ch.length > 1)
ok('every chunk within size bound', ch.every(c => c.length <= 900 * 1.7))
ok('chunkText empty -> []', chunkText('').length === 0)
ok('chunkText short -> 1 chunk', chunkText('hello world this is a short doc').length === 1)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
