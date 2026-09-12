export function optimiseStock(stock: any[]) {
  return {
    slow: stock.filter(v => v.daysInStock > 40),
    fast: stock.filter(v => v.daysInStock < 20)
  };
}
