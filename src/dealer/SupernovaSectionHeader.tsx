export default function SupernovaSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2>{title}</h2>
      {subtitle && <p className="text-white/70">{subtitle}</p>}
    </div>
  );
}
