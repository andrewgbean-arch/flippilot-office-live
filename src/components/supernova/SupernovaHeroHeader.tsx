interface Props {
  title: string;
  subtitle: string;
}

export function SupernovaHeroHeader({ title, subtitle }: Props) {
  return (
    <div className="relative mb-10">
      <div className="absolute inset-0 blur-xl bg-gradient-to-r from-yellow-500/20 via-blue-500/20 to-purple-500/20 animate-pulse" />

      <div className="relative p-6 rounded-xl border border-yellow-500/40 bg-black/40 backdrop-blur-xl shadow-[0_0_25px_rgba(255,215,0,0.25)]">
        <h1 className="text-4xl font-extrabold text-yellow-400 tracking-wide drop-shadow-lg">
          {title}
        </h1>
        <p className="text-white/70 mt-2 text-lg">{subtitle}</p>
      </div>
    </div>
  );
}
