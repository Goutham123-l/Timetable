// A fixed palette of literal Tailwind classes (Tailwind purges unused
// classes at build time, so these must appear as complete strings in source
// — not built dynamically from a variable color name).
const PALETTE = [
  { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700", dot: "bg-blue-400" },
  { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700", dot: "bg-emerald-400" },
  { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700", dot: "bg-amber-400" },
  { bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-700", dot: "bg-purple-400" },
  { bg: "bg-pink-50", border: "border-pink-400", text: "text-pink-700", dot: "bg-pink-400" },
  { bg: "bg-cyan-50", border: "border-cyan-400", text: "text-cyan-700", dot: "bg-cyan-400" },
  { bg: "bg-orange-50", border: "border-orange-400", text: "text-orange-700", dot: "bg-orange-400" },
  { bg: "bg-indigo-50", border: "border-indigo-400", text: "text-indigo-700", dot: "bg-indigo-400" },
  { bg: "bg-teal-50", border: "border-teal-400", text: "text-teal-700", dot: "bg-teal-400" },
  { bg: "bg-rose-50", border: "border-rose-400", text: "text-rose-700", dot: "bg-rose-400" },
  { bg: "bg-lime-50", border: "border-lime-500", text: "text-lime-700", dot: "bg-lime-500" },
  { bg: "bg-violet-50", border: "border-violet-400", text: "text-violet-700", dot: "bg-violet-400" },
];

/** Deterministic color for a subject, so the same subject always gets the
 * same color across every grid, every render, every session. */
export function subjectColor(key: string | number | undefined) {
  if (key === undefined || key === null) return PALETTE[0];
  const str = String(key);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}
