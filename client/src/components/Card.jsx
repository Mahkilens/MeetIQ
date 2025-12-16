export default function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </div>
  );
}
