import { Express, Request, Response } from "express";

export default function registerLookupRoute(app: Express) {
  app.get("/lookup", async (req: Request, res: Response) => {
    const reg = req.query.reg as string;

    if (!reg) {
      return res.status(400).json({ ok: false, error: "Missing reg" });
    }

    res.json({
      ok: true,
      reg,
      make: "Ford",
      model: "Fiesta",
      year: 2016,
      mileage: 62000
    });
  });
}
