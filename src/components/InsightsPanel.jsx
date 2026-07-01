import { useEffect, useState } from "react"
import { renderMermaidSVG } from "../lib/mermaidRender"

const fieldCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 leading-relaxed focus:outline-none focus:border-emerald-500"

// Editable bullet list — edit text in place, add a point, or remove one.
function BulletEditor({ items, onChange, addLabel = "+ Add point" }) {
  const set = (i, v) => onChange(items.map((it, idx) => (idx === i ? v : it)))
  const add = () => onChange([...items, ""])
  const del = (i) => onChange(items.filter((_, idx) => idx !== i))
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-emerald-400 mt-2.5 shrink-0 select-none">•</span>
          <textarea
            rows={1}
            className={fieldCls + " resize-y min-h-[38px]"}
            value={it}
            onChange={(e) => set(i, e.target.value)}
          />
          <button onClick={() => del(i)} className="text-zinc-500 hover:text-red-400 text-lg leading-none px-2 py-1.5 mt-0.5 rounded hover:bg-red-500/10 transition-colors" title="Remove this point">×</button>
        </div>
      ))}
      <button onClick={add} className="text-sm text-emerald-400 hover:text-emerald-300 font-medium px-1 py-1">{addLabel}</button>
    </div>
  )
}

// Section heading (the small green label) — turns into an input in edit mode so
// the user can rename "Key Observations" → "Notes" etc. if they want.
function SectionLabel({ text }) {
  return <p className="text-[11px] uppercase tracking-widest text-emerald-400 mb-1.5">{text}</p>
}

// Shows the generated insights (Purpose, Prerequisites, Key Observations, Summary,
// Flow diagram, FAQ) after annotation. With `onChange`, the whole block becomes
// editable so the user can polish every word before exporting — what they see
// here is exactly what lands in the PDF / HTML / Word exports.
export default function InsightsPanel({ insights, onChange }) {
  const [flowSvg, setFlowSvg] = useState("")
  const [editing, setEditing] = useState(false)

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
  const faqList = Array.isArray(faqs) ? faqs : []
  const hasFaqs = faqList.length > 0
  const canEdit = typeof onChange === "function"

  // Patch a single field on the insights object → flows straight into exports.
  const patch = (k, v) => onChange?.({ ...insights, [k]: v })
  const setFaq = (i, key, v) => patch("faqs", faqList.map((f, idx) => (idx === i ? { ...f, [key]: v } : f)))
  const addFaq = () => patch("faqs", [...faqList, { q: "", a: "" }])
  const delFaq = (i) => patch("faqs", faqList.filter((_, idx) => idx !== i))

  if (!editing && !purpose && !prereq.length && !keyObs.length && !summary && !hasFaqs && !flowSvg) return null

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 space-y-5">
      {/* Header + edit toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <p className="text-xs text-zinc-400 font-semibold uppercase tracking-widest truncate">
            Desktop Procedure · {editing ? "editing — type to change anything" : "auto-generated · also in your exports"}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing((e) => !e)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full ring-1 transition-colors ${
              editing
                ? "bg-emerald-600 hover:bg-emerald-500 text-white ring-emerald-500"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 ring-zinc-700"}`}>
            {editing ? "✓ Done" : "✎ Edit document"}
          </button>
        )}
      </div>

      {editing && (
        <p className="text-[12px] text-zinc-500 -mt-2">
          Tip: edit any text below, add or remove bullet points, and your changes appear in the PDF / Word / HTML exports.
        </p>
      )}

      {/* Purpose */}
      {(editing || purpose) && (
        <div>
          <SectionLabel text="Purpose" />
          {editing
            ? <textarea rows={3} className={fieldCls + " resize-y min-h-[72px]"} value={purpose || ""} onChange={(e) => patch("purpose", e.target.value)} placeholder="What this procedure lets the reader do, and why it matters." />
            : <p className="text-sm text-zinc-300 leading-relaxed">{purpose}</p>}
        </div>
      )}

      {/* Prerequisites */}
      {(editing || prereq.length > 0) && (
        <div>
          <SectionLabel text="Prerequisites" />
          {editing
            ? <BulletEditor items={prereq} onChange={(v) => patch("prerequisites", v)} addLabel="+ Add prerequisite" />
            : <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-300">{prereq.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        </div>
      )}

      {/* Key Observations */}
      {(editing || keyObs.length > 0) && (
        <div>
          <SectionLabel text="Key Observations" />
          {editing
            ? <BulletEditor items={keyObs} onChange={(v) => patch("keyObservations", v)} addLabel="+ Add observation" />
            : <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-300">{keyObs.map((o, i) => <li key={i}>{o}</li>)}</ul>}
        </div>
      )}

      {/* Executive Summary */}
      {(editing || summary) && (
        <div>
          <SectionLabel text="Executive Summary" />
          {editing
            ? <textarea rows={6} className={fieldCls + " resize-y min-h-[120px]"} value={summary || ""} onChange={(e) => patch("summary", e.target.value)} placeholder="A few sentences a reader can understand without watching the video." />
            : <p className="text-sm text-zinc-300 leading-relaxed border-l-2 border-emerald-500/50 pl-3">{summary}</p>}
        </div>
      )}

      {/* Flow diagram (view only — generated from the steps) */}
      {flowSvg && !editing && (
        <div>
          <SectionLabel text="Flow Diagram" />
          <div
            className="bg-white rounded-lg p-4 overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:mx-auto"
            dangerouslySetInnerHTML={{ __html: flowSvg }}
          />
        </div>
      )}

      {/* FAQ */}
      {(editing || hasFaqs) && (
        <div>
          <SectionLabel text={`FAQ${hasFaqs ? ` · ${faqList.length}` : ""}`} />
          {editing ? (
            <div className="space-y-3">
              {faqList.map((f, i) => (
                <div key={i} className="bg-zinc-800/50 border border-zinc-700/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold mt-2 shrink-0">Q</span>
                    <input className={fieldCls} value={f.q || ""} onChange={(e) => setFaq(i, "q", e.target.value)} placeholder="Question" />
                    <button onClick={() => delFaq(i)} className="text-zinc-500 hover:text-red-400 text-lg leading-none px-2 py-1.5 rounded hover:bg-red-500/10 transition-colors" title="Remove this FAQ">×</button>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-zinc-400 font-bold mt-2 shrink-0">A</span>
                    <textarea rows={2} className={fieldCls + " resize-y min-h-[52px]"} value={f.a || ""} onChange={(e) => setFaq(i, "a", e.target.value)} placeholder="Answer" />
                  </div>
                </div>
              ))}
              <button onClick={addFaq} className="text-sm text-emerald-400 hover:text-emerald-300 font-medium px-1 py-1">+ Add FAQ</button>
            </div>
          ) : (
            <div className="space-y-2">
              {faqList.map((f, i) => (
                <details key={i} className="group bg-zinc-800/50 border border-zinc-700/60 rounded-lg" open={i === 0}>
                  <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-zinc-200 flex items-center justify-between gap-3">
                    <span>{f.q}</span>
                    <span className="text-emerald-400 text-lg leading-none group-open:rotate-45 transition-transform shrink-0">+</span>
                  </summary>
                  <p className="px-3 pb-3 text-sm text-zinc-400 leading-relaxed border-t border-zinc-700/60 pt-2">{f.a}</p>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
