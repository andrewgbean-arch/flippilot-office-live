interface Props {
  hubs: string[];
}

export function SupernovaDashboardRibbon({ hubs }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {hubs.map((hub: string) => (
        <a
          key={hub}
          href={`/dealer/${hub.toLowerCase()}Hub`}
          className="p-4 rounded-xl bg-black/40 border border-yellow-500/40 text-yellow-400 font-bold text-center hover:bg-black/60 hover:shadow-[0_0_20px_rgba(255,215,0,0.35)] transition-all"
        >
          {hub}
        </a>
      ))}
    </div>
  );
}
