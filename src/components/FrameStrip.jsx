export default function FrameStrip({ frames, activeIndex, onSelect }) {
  if (!frames.length) return null

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
      <p className="text-xs text-zinc-500 mb-2">Frames — click to seek</p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {frames.map((frame, i) => (
          <button
            key={i}
            onClick={() => onSelect(frame.timestamp, i)}
            className={`flex-shrink-0 flex flex-col items-center gap-1 rounded-lg overflow-hidden border-2 transition-all
              ${activeIndex === i ? "border-emerald-400" : "border-transparent hover:border-zinc-600"}`}
          >
            <img
              src={frame.imageData}
              alt={frame.label}
              className="w-24 h-14 object-cover"
            />
            <span className="text-xs text-zinc-400 pb-1">{frame.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
