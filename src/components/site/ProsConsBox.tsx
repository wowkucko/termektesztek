export default function ProsConsBox({ pros, cons }: { pros: string[]; cons: string[] }) {
  if (pros.length === 0 && cons.length === 0) return null;

  return (
    <div className="not-prose grid gap-4 sm:grid-cols-2 my-8">
      <div className="rounded-card border border-pro/25 bg-pro/5 p-5">
        <h3 className="font-sans text-sm font-semibold text-pro">Előnyök</h3>
        <ul className="mt-3 space-y-2">
          {pros.map((item, i) => (
            <li key={i} className="flex items-start gap-2 font-body text-sm leading-relaxed text-ink/85">
              <span className="mt-0.5 text-pro" aria-hidden="true">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-card border border-con/25 bg-con/5 p-5">
        <h3 className="font-sans text-sm font-semibold text-con">Hátrányok</h3>
        <ul className="mt-3 space-y-2">
          {cons.map((item, i) => (
            <li key={i} className="flex items-start gap-2 font-body text-sm leading-relaxed text-ink/85">
              <span className="mt-0.5 text-con" aria-hidden="true">✕</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
