export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="MeetIQ"
            className="h-9 w-9 rounded-xl object-contain shadow-sm"
          />
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-900">Meeting Intelligence</div>
            <div className="text-xs text-slate-500">Local-first starter</div>
          </div>
        </div>
        <div className="text-xs text-slate-500">v0.1</div>
      </div>
    </header>
  );
}
