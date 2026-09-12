export default function MotBadge({ status }: { status: "PASS" | "FAIL" }) {
  const isPass = status === "PASS";

  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-semibold inline-flex items-center gap-1
        ${isPass ? "bg-green-500 text-white" : "bg-red-500 text-white"}
      `}
    >
      {isPass ? "✔" : "✖"} MOT {status}
    </span>
  );
}

