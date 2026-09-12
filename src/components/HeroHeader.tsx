type HeroHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: string;
};

export default function HeroHeader({ title, subtitle, badge }: HeroHeaderProps) {
  return (
    <header className="mb-8 bg-flipGlass border border-gold/20 rounded-xl p-6 backdrop-blur-xl shadow-goldGlow">

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gold drop-shadow-lg">
          {title}
        </h1>

        {subtitle && (
          <p className="text-white/80 text-sm">
            {subtitle}
          </p>
        )}
      </div>

      {badge && (
        <span className="mt-3 inline-block bg-gold/20 text-gold px-3 py-1 rounded-lg border border-gold/30 text-xs font-semibold">
          {badge}
        </span>
      )}
    </header>
  );
}
