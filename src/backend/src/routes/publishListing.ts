import { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";

export default function registerPublishedListingsRoute(app: Express) {
  app.get("/published-listings", (req: Request, res: Response) => {
    const filePath = path.join(__dirname, "../../data/published-listings.json");

    if (!fs.existsSync(filePath)) {
      return res.json({ listings: [] });
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const listings = JSON.parse(raw);

    res.json({ listings });
  });
}

