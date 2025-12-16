export default function Button({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary"
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2";

  const variants = {
    primary:
      "bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-600",
    subtle:
      "bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400",
    outline:
      "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 disabled:text-slate-400"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.primary}`}
    >
      {children}
    </button>
  );
}
