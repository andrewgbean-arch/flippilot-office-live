import { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";

export default function registerMessagesRoute(app: Express) {
  app.post("/messages/:listingId", (req: Request, res: Response) => {
    const listingId = Number(req.params.listingId);
    const { sender, message } = req.body;

    if (!sender || !message) {
      return res.status(400).json({ ok: false, error: "Missing sender or message" });
    }

    const filePath = path.join(__dirname, "../../data/published-listings.json");

    if (!fs.existsSync(filePath)) {
      return res.json({ ok: false, error: "No listings found" });
    }

    const listings = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const listing = listings.find((l: any) => l.id === listingId);

    if (!listing) {
      return res.json({ ok: false, error: "Listing not found" });
    }

    const newMessage = {
      sender,
      message,
      timestamp: new Date().toISOString()
    };

    listing.messages.push(newMessage);

    fs.writeFileSync(filePath, JSON.stringify(listings, null, 2));

    res.json({ ok: true, message: newMessage });
  });

  app.get("/messages/:listingId", (req: Request, res: Response) => {
    const listingId = Number(req.params.listingId);

    const filePath = path.join(__dirname, "../../data/published-listings.json");

    if (!fs.existsSync(filePath)) {
      return res.json({ ok: false, error: "No listings found" });
    }

    const listings = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const listing = listings.find((l: any) => l.id === listingId);

    if (!listing) {
      return res.json({ ok: false, error: "Listing not found" });
    }

    res.json({ ok: true, messages: listing.messages });
  });
}
