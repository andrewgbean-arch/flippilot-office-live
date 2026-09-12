type Props = {
  listing: any;
};

export default function CarHistoryChecker({ listing }: Props) {
  const vehicle = listing?.vehicle || {};

  let risk = 50;

  // Age risk
  const year = vehicle.year || 2010;
  const age = new Date().getFullYear() - year;
  if (age > 15) risk += 15;
  else if (age > 10) risk += 10;
  else if (age > 5) risk += 5;

  // Mileage risk
  const mileage = listing.mileage || 0;
  if (mileage > 150000) risk += 20;
  else if (mileage > 100000) risk += 10;
  else if (mileage > 70000) risk += 5;

  // Owner count risk
  const owners = listing.owners || 1;
  if (owners >= 5) risk += 15;
  else if (owners >= 3) risk += 10;
  else if (owners >= 2) risk += 5;

  // Service history
  if (listing.serviceHistory === "full") risk -= 15;
  else if (listing.serviceHistory === "partial") risk -= 5;
  else risk += 10;

  // MOT pattern (simple heuristic)
  if (listing.motFails >= 3) risk += 20;
  else if (listing.motFails >= 1) risk += 10;

  // Known model issues (simple heuristic)
  const knownIssues = ["timing chain", "gearbox", "injector", "rust"];
  const issueMatches = knownIssues.filter((issue) =>
    listing.description?.toLowerCase().includes(issue)
  ).length;

  if (issueMatches >= 2) risk += 15;
  else if (issueMatches >= 1) risk += 10;

  // Cap risk
  risk = Math.min(100, Math.max(0, risk));

  const getColor = () => {
    if (risk <= 40) return "#4CAF50"; // low risk
    if (risk <= 70) return "#FFD700"; // medium risk
    return "#FF5252"; // high risk
  };

  const getLabel = () => {
    if (risk <= 40) return "Low Risk";
    if (risk <= 70) return "Medium Risk";
    return "High Risk";
  };

  return (
    <div
      style={{
        marginTop: 12,
        backgroundColor: "#1A1A1A",
        padding: 12,
        borderRadius: 10,
        border: "1px solid #FFD700",
      }}
    >
      <p style={{ color: "#FFD700", fontWeight: "bold", marginBottom: 6 }}>
        Car History Risk
      </p>

      <p style={{ color: getColor(), fontSize: 18, fontWeight: "bold" }}>
        {getLabel()} ({risk}/100)
      </p>

      <p style={{ color: "#ccc", marginTop: 6 }}>
        This score reflects age, mileage, MOT history, owners, and known issues.
      </p>
    </div>
  );
}
