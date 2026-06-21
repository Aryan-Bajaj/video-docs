import { useEffect, useState } from "react"
import { renderMermaidSVG } from "../lib/mermaidRender"

// Shows the generated insights (Summary, Flow diagram, FAQ) right in the app
// after annotation — so the user sees these exist and will appear in exports.
export default function InsightsPanel({ insights }) {
  const [flowSvg, setFlowSvg] = useState("")

  useEffect(() => {
    let alive = true
    if (insights?.mermaid) {
      renderMermaidSVG(insights.mermaid).then((svg) => { if (alive) setFlowSvg(svg) })
    } else {
      setFlowSvg("")
    }
    return () => { alive = false }
  }, [insights?.mermaid])

  if (!insights) return null
  const { purpose, prerequisites, keyObservations, summary, faqs } = insights
  const prereq = Array.isArray(prerequisites) ? prerequisites : []
  const keyObs = Array.isArray(keyObservations) ? keyObservations : []
  const hasFaqs = Array.isArray(faqs) && faqs.length > 0
  if (!purpose && !prereq.length && !keyObs.length && !summary && !hasFaqs && !flowSvg) return null

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <p className="text-xs text-zinc-400 font-semibold uppercase tracking-widest">
          Desktop Procedure · auto-generated · also in your exports
        </p>
      </div>

      {purpose && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-emerald-400 mb-1.5">Purpose</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{purpose}</p>
        </div>
      )}

      {prereq.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-emerald-400 mb-1.5">Prerequisites</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-300">
            {prereq.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {keyObs.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-emerald-400 mb-1.5">Key Observations</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-300">
            {keyObs.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </div>
      )}

      {summary && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-emerald-400 mb-1.5">Executive Summary</p>
          <p className="text-sm text-zinc-300 leading-relaxed border-l-2 border-emerald-500/50 pl-3">{summary}</p>
        </div>
      )}

      {flowSvg && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-emerald-400 mb-1.5">Flow Diagram</p>
          <div
            className="bg-white rounded-lg p-4 overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:mx-auto"
            dangerouslySetInnerHTML={{ __html: flowSvg }}
          />
        </div>
      )}

      {hasFaqs && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-emerald-400 mb-2">FAQ · {faqs.length}</p>
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <details key={i} className="group bg-zinc-800/50 border border-zinc-700/60 rounded-lg" open={i === 0}>
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-zinc-200 flex items-center justify-between gap-3">
                  <span>{f.q}</span>
                  <span className="text-emerald-400 text-lg leading-none group-open:rotate-45 transition-transform shrink-0">+</span>
                </summary>
                <p className="px-3 pb-3 text-sm text-zinc-400 leading-relaxed border-t border-zinc-700/60 pt-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
