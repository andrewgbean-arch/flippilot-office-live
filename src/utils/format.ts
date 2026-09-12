export function formatCurrency(value: number | string) {
  const num = Number(value);
  if (isNaN(num)) return "£0";

  return `£${num.toFixed(2)}`;
}

