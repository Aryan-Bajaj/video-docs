// Looping animation of the "Talk to your documentation" feature (RAG chat).
// Pure CSS keyframes on a single ~13s cycle: question → thinking → answer → sources.

const CSS = `
  @keyframes dcd-in   { 0%,3%{opacity:0;transform:translateY(10px)} 8%,90%{opacity:1;transform:none} 96%,100%{opacity:0} }
  @keyframes dcd-q    { 0%,4%{opacity:0;transform:translateY(8px)} 9%,90%{opacity:1;transform:none} 96%,100%{opacity:0} }
  @keyframes dcd-think{ 0%,12%{opacity:0} 16%,30%{opacity:1} 34%,100%{opacity:0} }
  @keyframes dcd-a    { 0%,33%{opacity:0;transform:translateY(6px)} 40%,90%{opacity:1;transform:none} 96%,100%{opacity:0} }
  @keyframes dcd-src  { 0%,52%{opacity:0;transform:scale(.85)} 58%,90%{opacity:1;transform:scale(1)} 96%,100%{opacity:0} }
  @keyframes dcd-blink{ 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes dcd-dot  { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-3px);opacity:1} }
`

const SRC_COLORS = ['#3f62ff', '#a78bfa', '#22d3ee']

export default function DocChatDemo() {
  const cycle = '13s'
  return (
    <>
      <style>{CSS}</style>
      <div style={{
        width: '100%', maxWidth: 560, margin: '0 auto',
        background: 'rgba(13,10,35,0.85)', border: '1px solid rgba(52,211,153,0.22)',
        borderRadius: 18, overflow: 'hidden', backdropFilter: 'blur(20px)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(52,211,153,0.06)',
      }}>
        {/* header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: 14 }}>💬</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#86efac', letterSpacing: '0.02em' }}>Vid Chat</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>in-browser · cites the step</span>
        </div>

        {/* body */}
        <div style={{ padding: '18px 16px', minHeight: 230, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* question */}
          <div style={{ alignSelf: 'flex-end', maxWidth: '85%', animation: `dcd-q ${cycle} ease-in-out infinite` }}>
            <div style={{ background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.3)', color: '#d1fae5', fontSize: 13, padding: '9px 13px', borderRadius: '12px 12px 2px 12px' }}>
              How do I run the macro?
            </div>
          </div>

          {/* thinking */}
          <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '4px 2px', animation: `dcd-think ${cycle} ease-in-out infinite` }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#7b96ff', animation: `dcd-dot 0.9s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>

          {/* answer */}
          <div style={{ alignSelf: 'flex-start', maxWidth: '90%', animation: `dcd-a ${cycle} ease-in-out infinite` }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 1.6, padding: '11px 14px', borderRadius: '12px 12px 12px 2px' }}>
              Press <b style={{ color: '#fff' }}>Alt + F11</b> to open the VBA editor, then run <b style={{ color: '#fff' }}>RunFullMapping</b> from the macro list (Alt + F8). Progress shows in the status bar.
            </div>

            {/* source chips */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, animation: `dcd-src ${cycle} ease-in-out infinite` }}>
              {['02:14', '03:48', '05:02'].map((ts, i) => (
                <div key={ts} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, paddingRight: 9 }}>
                  <div style={{ width: 40, height: 26, borderRadius: '8px 0 0 8px', background: `linear-gradient(135deg, ${SRC_COLORS[i]}66, ${SRC_COLORS[i]}22)`, borderRight: '1px solid rgba(255,255,255,0.08)' }} />
                  <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>↳ {ts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' }}>
            Ask about this recording…<span style={{ width: 1.5, height: 14, background: '#86efac', marginLeft: 3, animation: 'dcd-blink 1s step-end infinite' }} />
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#10b981,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>➤</div>
        </div>
      </div>
    </>
  )
}
