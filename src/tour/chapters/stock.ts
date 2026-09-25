// The "Your stock and photos" chapter of the guided tour: every stock screen,
// top to bottom, with its written help. Every line must be true of the app as
// it is (see tourPlan.ts for the shapes and how targets are found).

import type { TourChapter, TourRouteContext } from "../tourPlan";
import { canSeeMoney } from "@/lib/permissions";

const car = (path: (id: string) => string) => (ctx: TourRouteContext) => (ctx.firstVehicleId ? path(ctx.firstVehicleId) : null);

// The car page's tab bar; the tabs are always in this order (Costs and Profit
// only for the money roles, so Edit is found as the last one).
const carTab = (n: number) => `css:[data-tour="tour-vehicle-tabs"] [role="tab"]:nth-child(${n})`;

export const chapter: TourChapter = {
  id: "stock",
  title: "Your stock and photos",
  blurb: "Adding cars, each car's page, Photo Studio, MOTs and bringing in a list.",
  pages: [
    // ------------------------------------------------------------------
    {
      id: "stock-overview",
      title: "Stock Overview",
      route: "/dealer/inventory",
      steps: [
        {
          id: "stock-overview-summary",
          target: "css:main section",
          title: "Your stock in numbers",
          narration:
            "These six counts come straight from the cars you still have to sell, so they're only as good as your records. They're here to spot trouble at a glance. To see which cars are behind a number, head to the Vehicle List.",
        },
        {
          id: "stock-overview-mot",
          target: "heading:MOT Expired or Due",
          title: "MOT warnings",
          narration:
            "The first row is about MOTs. It counts cars whose MOT has run out or ends within thirty days, and cars with advisories on their latest test. A car nobody has looked up has no MOT date at all, so run an MOT Lookup on new stock.",
        },
        {
          id: "stock-overview-ready",
          target: "heading:No Asking Price Set",
          title: "Ready to sell?",
          narration:
            "The second row is about selling. It counts cars with no asking price, cars that have been in stock ninety days or more, and cars without a single photo. Days in stock count from the day the car was added to FlipPilot.",
        },
        {
          id: "stock-overview-actions",
          target: "heading:Actions",
          title: "Quick actions",
          narration:
            "These buttons jump to the jobs you'll do most: Add Vehicle, Scan VIN on the Stock Tools page, Run Risk Check in your reports, View Vehicle List and MOT Lookup. Parts & Labour Log records costs in your books, so it's for the owner, managers and finance.",
        },
        {
          id: "stock-overview-analytics",
          target: "heading:Stock, Sales and Lead Figures",
          title: "The bigger picture",
          narration:
            "For the bigger picture, Open Analytics takes you to your reports: MOT dates, prices, mileage and how long cars have been in stock, all counted from your own records rather than guessed.",
        },
      ],
      guide: {
        summary:
          "Stock Overview is a quick health check on the cars you still have to sell. It counts MOT problems, missing prices, missing photos and old stock from your own records, with buttons to the stock tools you'll want next.",
        howTo: [
          {
            question: "How do I find the cars behind a count?",
            steps: [
              "Note which count needs attention, for example No Asking Price Set.",
              "Press View Vehicle List.",
              "Look down the list: a car with no price says No price set, and the MOT pill turns amber when it's due soon and red when it has expired.",
              "Choose Longest in stock from Sort to bring the oldest cars to the top.",
              "Open the car with its Overview button and fix what's missing.",
            ],
          },
          {
            question: "How do I clear the MOT warnings?",
            steps: [
              "Press MOT Lookup.",
              "Type the car's registration exactly as it's shown on the car's record, space included.",
              "Press Lookup.",
              "The car's MOT record in your stock updates, and the counts here follow.",
            ],
          },
        ],
        tips: [
          "Sold cars are left out of every count here.",
          "A car with no MOT date isn't counted as due, so look up every new car to have it watched properly.",
        ],
        access:
          "Everyone can see this page. The Parts & Labour Log records costs in your books, which only the owner, managers and finance can do.",
      },
    },

    // ------------------------------------------------------------------
    {
      id: "vehicle-list",
      title: "Vehicle List",
      route: "/dealer/inventory/list",
      steps: [
        {
          id: "vehicle-list-header",
          target: "tour-vehicle-list",
          title: "Your vehicle list",
          narration:
            "This is every car you have, with how many are in stock and how many you've sold. Add vehicle starts a new car, and on a computer, Import from CSV brings in a whole list from a spreadsheet.",
        },
        {
          id: "vehicle-list-search",
          target: 'css:main input[type="search"]',
          title: "Finding a car",
          narration:
            "Type here to find a car by make, model, year, colour or registration. You don't need the space in a plate: it finds it either way. Every word you type has to match, so add another word to narrow it down.",
        },
        {
          id: "vehicle-list-filter",
          target: 'css:main [role="group"]',
          title: "In stock, sold or all",
          narration:
            "These buttons switch between cars in stock, cars you've sold, and everything, with a count on each. The list opens on In stock, so you see what still needs selling first.",
        },
        {
          id: "vehicle-list-sort",
          target: "css:main select",
          title: "Sorting the list",
          narration:
            "Sort puts the list in the order you need: newest first, longest in stock, price high to low or low to high, or make and model from A to Z. Longest in stock is a good way to spot the cars that need a push.",
        },
        {
          id: "vehicle-list-card",
          target: "css:main ul > li",
          title: "Each car at a glance",
          narration:
            "Each card shows the main photo, the plate, year and mileage, and the asking price, or what it sold for. Days in stock turn amber at sixty days and red at ninety. The pills show its status, MOT and ULEZ. Click anywhere on the card to open the car.",
        },
        {
          id: "vehicle-list-buttons",
          target: "tour-vehicle-list-buttons",
          title: "Overview and MOT",
          narration:
            "Overview opens the car's full page. MOT goes straight to its MOT record, with the advisories, every test and next steps. If a car has never had an MOT lookup, run one first from MOT Lookup.",
        },
      ],
      guide: {
        summary:
          "The Vehicle List is your whole stock in one place. Each car shows its price, days in stock, MOT and ULEZ at a glance, and you can search, filter and sort to find the one you want.",
        howTo: [
          {
            question: "How do I find a particular car?",
            steps: [
              "Type the make, model or registration in the search box.",
              "If it isn't there, press All in case it has been sold.",
              "Click the car to open its page.",
            ],
          },
          {
            question: "How do I see which cars have been here longest?",
            steps: [
              "Choose Longest in stock from the Sort list.",
              "Look for days in stock in amber (sixty days or more) or red (ninety or more).",
              "Open the car and review its price and photos.",
            ],
          },
          {
            question: "How do I add cars?",
            steps: [
              "Press Add vehicle to add one car.",
              "Or, on a computer, press Import from CSV to bring in a spreadsheet of stock.",
            ],
          },
        ],
        tips: [
          "A red MOT pill means the MOT has expired; amber means it's due within thirty days.",
          "A car with no asking price shows No price set instead of a price.",
          "Days in stock count from the day the car was added to FlipPilot, so imported stock starts from the import date.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "car-page",
      title: "A car's page",
      route: car(id => `/dealer/inventory/${id}`),
      steps: [
        {
          id: "car-page-glance",
          target: "css:main dl",
          title: "The car at a glance",
          narration:
            "Every car's page opens with its plate, year, mileage and status, then four quick facts: the asking price, or what it sold for, how many days it's been in stock, where its MOT stands, and the mileage. All vehicles takes you back to the list.",
        },
        {
          id: "car-page-photos",
          target: "heading:Photos",
          title: "The car's photos",
          narration:
            "Here's the main photo with the rest underneath. Click any photo to see it full size and flick through them. Edit in Photo Studio is where you tidy them up, and if there are no photos yet, Add Photos takes you to the Edit tab to upload some.",
        },
        {
          id: "car-page-snapshot",
          target: "heading:Vehicle Snapshot",
          title: "Vehicle snapshot",
          narration:
            "The snapshot lists the make, model, year and mileage, then what the MOT record says: its status and expiry, the advisories and any failure items in its history, plus ULEZ. With no MOT data yet, there's a link to run a lookup. Full MOT History below opens the MOT tab.",
        },
        {
          id: "car-page-purchase",
          target: "heading:Purchase / Sale",
          title: "Purchase and sale",
          narration:
            "This shows the asking price, or the sale price once it's sold. What you paid shows here for the owner, managers and finance only. They also get the Recon Workflow button below, for logging the preparation work and its cost against the car.",
        },
        {
          id: "car-page-tabs",
          target: "tour-vehicle-tabs",
          title: "MOT and market pricing",
          narration:
            "These tabs hold the rest of the car's record. MOT has its expiry, advisories and every test on record, most recent first. Market pricing shows real eBay dealer listings for similar cars, and Check Google Dealer Prices gets a second opinion. Remember, those are asking prices, not sale prices.",
        },
        {
          id: "car-page-passport",
          target: carTab(4),
          title: "The Car Passport",
          narration:
            "Car Passport makes a web page for this car that buyers can open. Choose what it shows, like the MOT history, ULEZ and how the price compares, and add the work you've done. Switch it live, then copy the link or print a QR card. What you paid is never shown.",
        },
        {
          id: "car-page-money",
          target: carTab(5),
          showIf: canSeeMoney,
          title: "Costs and profit",
          narration:
            "Costs and Profit are for the owner, managers and finance. Costs shows the car's line from your books, with Add Cost for parts, labour, transport and the rest. Profit sets the price you paid and every cost against the asking price, before any VAT due on the sale, with a rough risk check.",
        },
        {
          id: "car-page-edit",
          target: `css:[data-tour="tour-vehicle-tabs"] [role="tab"]:last-child`,
          title: "Editing the car",
          narration:
            "On the Edit tab you change the details, asking price and VAT scheme, write notes, and upload photos and choose the cover. Press Generate with AI and I'll draft a listing description from the car's real details for you to check. Save Vehicle keeps it all. Deleting a car is for the owner and managers.",
        },
      ],
      guide: {
        summary:
          "Every car has its own page with everything about it: photos, MOT, market prices, its public Car Passport and its details. If you look after the money, its costs and profit are here too.",
        howTo: [
          {
            question: "How do I change a car's price?",
            steps: ["Open the Edit tab.", "Change Retail Price (£).", "Press Save Vehicle."],
          },
          {
            question: "How do I write the advert?",
            steps: [
              "Open the Edit tab.",
              "Scroll to Listing Description.",
              "Press Generate with AI for a draft made from the car's real details, or type your own.",
              "Read it through and change anything that isn't right.",
              "Press Save Vehicle.",
            ],
          },
          {
            question: "How do I put the car's page online for buyers?",
            steps: [
              "Open the Car Passport tab.",
              "Choose what buyers see, and add short lines about the work you've done.",
              "Turn on Live on the web.",
              "Press Save changes.",
              "Press Copy for the link, or Print a QR card for the windscreen.",
            ],
          },
          {
            question: "How do I log a cost against this car?",
            steps: [
              "Open the Costs tab.",
              "Press + Add Cost.",
              "Choose the Cost Type, and enter the Amount and the VAT details.",
              "Press Save Cost.",
            ],
          },
          {
            question: "How do I delete a car?",
            steps: [
              "Open the Edit tab.",
              "Press Delete Vehicle, then Delete Forever.",
              "You have ten seconds to press Undo Delete if you change your mind.",
            ],
          },
        ],
        tips: [
          "A car that has never had an MOT lookup has nothing to show on its MOT tab, so run MOT Lookup on its registration first.",
          "Market pricing figures are dealer asking prices, so real sale prices may be different.",
          "Notes stay inside FlipPilot: they're never shown on the Car Passport. Use Listing Description for words buyers should see.",
        ],
        access:
          "The Costs and Profit tabs, the purchase price, the trade price on the Edit tab and the Recon Workflow button are for the owner, managers and finance. Sales staff, managers and the owner can publish a Car Passport; everyone else can only look. Only the owner and managers can delete a car.",
      },
    },

    // ------------------------------------------------------------------
    {
      id: "add-vehicle",
      title: "Add Vehicle",
      route: "/new-flip",
      steps: [
        {
          id: "add-vehicle-details",
          target: "css:main .max-w-4xl > :nth-child(2)",
          title: "Start with the plate",
          narration:
            "Type the registration and press Lookup MOT. I'll fetch the government record and fill in the make, model, year, colour and mileage, with an MOT summary further down. Check them over, and add a title if you like. You need at least a make and model to save.",
        },
        {
          id: "add-vehicle-pricing",
          target: "css:main .max-w-4xl > :nth-child(4)",
          showIf: canSeeMoney,
          title: "Prices and VAT",
          narration:
            "Buy Price is required, and it goes into your books as the car's purchase, with where you bought it and when. Sell Price is optional. Pick the VAT scheme for when it's sold: Margin Scheme for most used cars, or Standard if you got a VAT invoice. Live Profit updates as you type.",
        },
        {
          id: "add-vehicle-pricing-team",
          target: "css:main .max-w-4xl > :nth-child(4)",
          showIf: user => !canSeeMoney(user),
          title: "Prices and VAT",
          narration:
            "Sell Price is the asking price everyone sees. What the car cost is kept by the owner, managers and finance, so there's no Buy Price box for you: let one of them know the figure. Pick Margin Scheme for most used cars, or Standard if there was a VAT invoice.",
        },
        {
          id: "add-vehicle-notes",
          target: "css:main .max-w-4xl > :nth-child(6)",
          title: "Notes for the team",
          narration:
            "Notes are for your team: where the keys are, what it needs, anything worth remembering. They stay inside FlipPilot and are never shown on the car's public Car Passport.",
        },
        {
          id: "add-vehicle-images",
          target: "css:main .max-w-4xl > :nth-child(8)",
          title: "First photos",
          narration:
            "Add photos here one at a time. Each one can be edited or removed before you save. You can add plenty more later, and tidy them all up properly in Photo Studio.",
        },
        {
          id: "add-vehicle-save",
          target: "button:Save Vehicle",
          title: "Saving the car",
          narration:
            "When you're happy, press Save Vehicle. The car goes straight into your stock and I'll open its page, ready for more photos, a listing description and its Car Passport.",
        },
      ],
      guide: {
        summary:
          "Add Vehicle puts a new car into your stock. Look up the registration to fill in the details from government records, add the prices and VAT scheme, then save.",
        howTo: [
          {
            question: "How do I add a car quickly?",
            steps: [
              "Type the Registration and press Lookup MOT.",
              "Check the Make, Model, Year, Colour and Mileage it filled in.",
              "Enter the Buy Price and, if you know it, the Sell Price.",
              "Choose the VAT Scheme.",
              "Press Save Vehicle.",
            ],
          },
          {
            question: "Which VAT scheme should I pick?",
            steps: [
              "Choose Margin Scheme if there was no VAT invoice when you bought it: private sellers, trade-ins and most used cars.",
              "Choose Standard VAT if you got a VAT invoice, then pick the VAT Rate on this Purchase and say whether the price included VAT.",
            ],
          },
          {
            question: "What if the lookup finds nothing?",
            steps: [
              "Check the registration is typed correctly and press Lookup MOT again.",
              "If nothing fills in, type the Make, Model and the other details yourself.",
            ],
          },
        ],
        tips: [
          "Engine Size isn't saved with the car yet, so put it in the title or the notes if it matters.",
          "If you only fill in the Vehicle Title, the first word is used as the make and the rest as the model.",
        ],
        access:
          "Anyone can add a car. The Buy Price is kept, and goes into the books as the purchase, only for the owner, managers and finance.",
      },
    },

    // ------------------------------------------------------------------
    {
      id: "photo-studio",
      title: "Photo Studio",
      route: "/photo-studio",
      steps: [
        {
          id: "photo-studio-header",
          target: "css:main header",
          title: "Photo Studio",
          narration:
            "Photo Studio is where your pictures get sorted. It covers every car you still have for sale, so sold cars never clutter it up, and it puts the cars that most need photos at the front.",
        },
        {
          id: "photo-studio-coverage",
          target: "css:main .grid",
          title: "Photos on your stock",
          narration:
            "These three numbers show how many cars in stock have at least one photo, how many photos there are in all, and the average per car. Good photos help a car sell, so it's worth keeping that average up.",
        },
        {
          id: "photo-studio-cars",
          target: 'css:main a[href^="/photo-studio/"]',
          title: "Open a car",
          narration:
            "Each car shows its main photo and a badge counting its photos against the eight recommended shots, in orange when it has none. The cars with the fewest photos come first. Click one to edit its photos, make social media posts and check its shot list.",
        },
      ],
      guide: {
        summary:
          "Photo Studio shows how well your stock is photographed and which cars need pictures most. Open any car to reorder, fix and brand its photos, and to make posts for social media.",
        howTo: [
          {
            question: "How do I find the cars that need photos?",
            steps: [
              "Look at the first cars in the list: they have the fewest photos.",
              "An orange badge means a car has none at all.",
              "Click the car to open it in Photo Studio.",
            ],
          },
          {
            question: "How do I add photos to a car?",
            steps: [
              "Click the car.",
              "Press Add photos, which opens the car's Edit tab.",
              "Choose your photos under Images and press Save Vehicle.",
            ],
          },
        ],
        tips: [
          "The badge counts photos, not which shots they are, so check the Shot List on the car to see what's missing.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "photo-studio-car",
      title: "Photo Studio for a car",
      route: car(id => `/photo-studio/${id}`),
      steps: [
        {
          id: "photo-studio-car-title",
          target: "css:main h1",
          title: "This car's photos",
          narration:
            "Here are one car's photos. Under its name you'll see how many it has, and how many I've flagged to check. I look at every photo for being too dark, too bright, blurry or too small.",
        },
        {
          id: "photo-studio-car-buttons",
          target: "button:Add photos",
          title: "Adding photos",
          narration:
            "Add photos takes you to the car's Edit tab, where you can upload more from your computer. Open the car goes to its full page, with its MOT, prices and Car Passport.",
        },
        {
          id: "photo-studio-car-strip",
          target: 'css:section[aria-label="Photos"]',
          title: "Putting them in order",
          narration:
            "Drag photos into the order you want, or use the arrows. Press the star to make one the main photo, the one buyers see first everywhere. The new order saves straight away. A flag on a photo, like Too dark, tells you what to fix.",
        },
        {
          id: "photo-studio-car-editor",
          target: 'css:section[aria-label="Editor"]',
          title: "Making photos shine",
          narration:
            "Pick a photo, then use these tabs. Light & turn fixes brightness, contrast and a wonky horizon. Crop squares it up for listings. Banner adds a label like Just Arrived, Reduced or a price strip. Your name puts your dealership in the corner, and Number plate blurs the plate or covers it with your name.",
        },
        {
          id: "photo-studio-car-save",
          target: "button:Save as a new photo",
          title: "Keeping your edits",
          narration:
            "Save as a new photo keeps the original and puts the edited copy next to it. Replace the original swaps it, after asking you first. Download saves a copy to your computer, and Undo all clears your changes.",
        },
        {
          id: "photo-studio-car-posts",
          target: "tour-social-posts",
          title: "Posts for social media",
          narration:
            "One click turns the photo into a square post or a story, with the car's name, price and mileage, your dealership's name and your phone number. It downloads to your device, ready for you to post on Facebook or Instagram yourself. Nothing is posted for you.",
        },
        {
          id: "photo-studio-car-shots",
          target: "heading:SHOT LIST",
          title: "The shot list",
          narration:
            "The shot list is the eight pictures buyers look for, from the front three-quarter to the wheels and tyres. The count above it is simply how many photos the car has, so check the list by eye to see what's missing.",
        },
        {
          id: "photo-studio-car-backdrop",
          target: "heading:SHOWROOM BACKDROP",
          title: "Coming soon",
          narration:
            "Showroom backdrop is coming soon. It will swap a busy forecourt for a clean background, and it will always ask before using any of your credit. For now, a tidy spot and good light make the biggest difference.",
        },
      ],
      guide: {
        summary:
          "This is where one car's photos are put in order and polished. You can brighten, straighten and crop, add a banner or your name, cover the number plate, and make ready-sized posts for social media.",
        howTo: [
          {
            question: "How do I change the main photo?",
            steps: [
              "Find the photo in the strip at the top.",
              "Press its star.",
              "It moves to the front and becomes the photo buyers see first.",
            ],
          },
          {
            question: "How do I cover the number plate?",
            steps: [
              "Click the photo in the strip.",
              "Open the Number plate tab.",
              "Drag a box over the plate on the photo.",
              "Choose Blur it or Your name on it.",
              "Press Save as a new photo or Replace the original.",
            ],
          },
          {
            question: "How do I make a Facebook or Instagram post?",
            steps: [
              "Pick the photo, and edit it first if you like.",
              "Press Square post for the feed, or Story for stories.",
              "The picture downloads to your device.",
              "Post it from Facebook or Instagram yourself.",
            ],
          },
          {
            question: "How do I put my name on a photo?",
            steps: [
              "Open the Your name tab.",
              "Tick the box to put your dealership's name in the corner.",
              "If no name shows, add it in Settings under Dealer Profile first.",
              "Press Save as a new photo or Replace the original.",
            ],
          },
        ],
        tips: [
          "Light & turn can rescue a dark photo, but a blurry one is best retaken.",
          "Posts use the car's asking price, so set one first if you want it on the picture.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "mot-lookup",
      title: "MOT Lookup",
      route: "/dealer/inventory/mot-lookup",
      steps: [
        {
          id: "mot-lookup-reg",
          target: "css:main input",
          title: "Check any registration",
          narration:
            "Type any registration here to fetch its MOT history from the government records. It works for your own stock, a trade-in you're thinking about, or a customer's car booked in for work.",
        },
        {
          id: "mot-lookup-button",
          target: "button:Lookup",
          title: "What you get back",
          narration:
            "Press Lookup and you'll see whether the MOT is valid and how many days are left, a rough rule-of-thumb check, the advisories, the mileage at each test, and every test on record, most recent first.",
        },
        {
          id: "mot-lookup-stock",
          target: "",
          title: "Your stock stays current",
          narration:
            "If the car is in your stock, its MOT record updates on the spot, so the warnings across FlipPilot follow. If it isn't, nothing is saved: it's just a look. If you've bought it, press Add as New Vehicle to put it in your stock.",
        },
      ],
      guide: {
        summary:
          "MOT Lookup fetches the full government MOT record for any registration. A car in your stock is updated automatically; anything else is a look only, unless you choose to add it.",
        howTo: [
          {
            question: "How do I check a car's MOT?",
            steps: [
              "Type the registration in the box.",
              "Press Lookup.",
              "Read the status, advisories and test history below.",
            ],
          },
          {
            question: "How do I update the MOT on a car in my stock?",
            steps: [
              "Type its registration exactly as it's shown on the car's record, space included.",
              "Press Lookup.",
              "Look for the line saying its MOT record was updated in your inventory.",
            ],
          },
          {
            question: "How do I add a car I've just bought from its registration?",
            steps: [
              "Look it up.",
              "Press Add as New Vehicle.",
              "Open it from the Vehicle List to add its prices and photos.",
            ],
          },
        ],
        tips: [
          "The check and outlook cards are a rough guide worked out from the test record, not a prediction that it will pass.",
          "If nothing appears after pressing Lookup, check the registration and try again.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "stock-tools",
      title: "Stock Tools",
      route: "/dealer/tools",
      steps: [
        {
          id: "stock-tools-vehicles",
          target: "heading:Vehicle Management",
          title: "Handy shortcuts",
          narration:
            "Stock Tools gathers handy shortcuts in one place. Vehicle Management has Add Vehicle and Vehicle List, the two you'll use most. The Scan VIN button on Stock Overview brings you here too.",
        },
        {
          id: "stock-tools-vin",
          target: "heading:VIN Scanner",
          title: "Checking a VIN",
          narration:
            "Despite the name, this doesn't use a camera. Type a seventeen character VIN and press Scan VIN, and it reads the maker and model year from it. It only knows five makers, Ford, Volkswagen, Mercedes, BMW and Toyota, so treat it as a rough check.",
        },
        {
          id: "stock-tools-optimiser",
          target: "heading:Stock Optimiser",
          title: "Slow and fast movers",
          narration:
            "The stock optimiser counts your unsold cars that have been here over forty days, the slow movers, and under twenty days, the fast ones. To see which cars they are, sort the Vehicle List by Longest in stock.",
        },
        {
          id: "stock-tools-photos",
          target: "heading:Photo Studio",
          title: "Photo Studio",
          narration:
            "Open Photo Studio takes you to your stock's photos, with the cars that most need pictures first. From there you can tidy them up and make posts for social media.",
        },
        {
          id: "stock-tools-marketplace",
          target: "heading:Marketplace Tools",
          title: "Marketplace Sync",
          narration:
            "Marketplace Sync builds a CSV stock feed you can hand to a listing portal. Nothing is sent to any portal automatically, so you stay in control of what goes where.",
        },
        {
          id: "stock-tools-dealer-ops",
          target: "heading:Dealer Operations",
          title: "Other tools",
          narration:
            "Dealer Operations links to the Staff area, the Finance tools such as the finance calculator and deal sheet, and the Risk hub in your reports.",
        },
        {
          id: "stock-tools-coming",
          target: "heading:Coming Soon",
          title: "Coming soon",
          narration:
            "The Coming Soon list is exactly that: tools that aren't built yet, so there's nothing here to press. They'll appear on this page when they're ready.",
        },
      ],
      guide: {
        summary:
          "Stock Tools is a page of shortcuts plus two small tools: a VIN check that reads the maker and model year for five makes, and a count of your slow and fast moving stock.",
        howTo: [
          {
            question: "How do I check a VIN?",
            steps: [
              "Type the 17-character VIN in the VIN box.",
              "Press Scan VIN.",
              "Read the Make and Model Year it shows.",
              "Enter the rest of the details yourself when you add the car.",
            ],
          },
          {
            question: "How do I see my slow movers?",
            steps: [
              "Read the Stock Optimiser count here.",
              "Go to the Vehicle List and choose Longest in stock from Sort.",
              "Open the oldest cars and review their price and photos.",
            ],
          },
        ],
        tips: [
          "For a car's full details, Lookup MOT on the Add Vehicle page does far more with the registration than a VIN can.",
          "A make the VIN check doesn't know shows as Unknown; that doesn't mean the VIN is wrong.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "import-csv",
      title: "Import from CSV",
      route: "/import",
      steps: [
        {
          id: "import-csv-type",
          target: "button:Vehicle Inventory",
          title: "What are you importing?",
          narration:
            "This page brings a list in from a spreadsheet. First choose what it is: Vehicle Inventory for cars, or Consumables / Parts for your workshop stock. Switching between them clears any file you've picked.",
        },
        {
          id: "import-csv-file",
          target: "css:main div:has(> #importscreen-csv-file)",
          title: "Pick your CSV",
          narration:
            "Save your spreadsheet as a CSV file, then choose it here. Excel and Google Sheets can both do that. I'll say how many rows I found, and show you the first few exactly as they are in the file.",
        },
        {
          id: "import-csv-help",
          target: "button:Need Help?",
          title: "Step by step",
          narration:
            "If you'd like a hand, Need Help? opens a step-by-step guide to the whole import, from saving the CSV to the final button.",
        },
        {
          id: "import-csv-match",
          target: "",
          title: "Match, preview, import",
          narration:
            "Next you match your columns to mine. Common names like make, reg or asking price are matched for you. The preview shows which rows are ready and flags anything missing or unreadable. Nothing is saved until you press the Import button.",
        },
      ],
      guide: {
        summary:
          "Import from a File brings your existing stock or parts list in from a CSV file, whether it's from a spreadsheet or another system. You match the columns, check a preview, and nothing is saved until you press Import.",
        howTo: [
          {
            question: "How do I import my stock list?",
            steps: [
              "Press Vehicle Inventory.",
              "Save your spreadsheet as a CSV and choose it under CSV file.",
              "Check that Your file, as uploaded looks right.",
              "Under Match your columns, fix any field showing — Not in file —. Make and Model are required.",
              "Check the Preview, then press the Import button.",
            ],
          },
          {
            question: "What happens to buy prices in the file?",
            steps: [
              "For the owner, managers and finance, each buy price also goes into Bookkeeping as the car's purchase, with no VAT recorded.",
              "A price that can't be read, like 45k, is left blank, and the result says how many.",
              "Set each car's VAT scheme afterwards on its Edit tab.",
            ],
          },
          {
            question: "Can I import workshop parts?",
            steps: [
              "Press Consumables / Parts.",
              "Choose your CSV.",
              "Match at least the Item Name column.",
              "Press the Import button.",
            ],
          },
        ],
        tips: [
          "Importing the same file twice adds the cars twice, so import each list only once.",
          "An .xlsx file can't be read directly: save it as CSV first.",
        ],
        access:
          "Anyone can import. Buy prices are only kept, and only reach the books, for the owner, managers and finance.",
      },
    },

    // ------------------------------------------------------------------
    // Reached from Stock Overview's Parts & Labour Log button. Not a money
    // page in pageAccess, but everything on it is the Bookkeeping ledger,
    // which the server only sends the money roles.
    {
      id: "parts-labour",
      title: "Parts & Labour Log",
      route: "/dealer/inventory/parts-labour",
      showIf: canSeeMoney,
      steps: [
        {
          id: "parts-labour-pick",
          target: "css:main select",
          title: "Pick a car",
          narration:
            "The Parts & Labour Log keeps each car's repair spend in one place. Start by picking the car here, and I'll show the parts and labour logged against it, with links to find parts.",
        },
        {
          id: "parts-labour-parts",
          target: "",
          title: "Finding parts",
          narration:
            "Once a car is picked, Find Parts opens parts sites in a new tab. eBay Motors searches with the car's registration already filled in. Euro Car Parts and GSF Car Parts just open their sites, so type the registration in there.",
        },
        {
          id: "parts-labour-costs",
          target: "",
          title: "Logging the spend",
          narration:
            "Below that, Recon Costs lists the parts and labour logged against the car, with a total. Add Cost records a new one in your books, with its VAT and supplier, so the car's profit stays right.",
        },
      ],
      guide: {
        summary:
          "The Parts & Labour Log shows what each car has cost in parts and labour, lets you log more, and opens parts sites to find what it needs.",
        howTo: [
          {
            question: "How do I log a part or a labour charge?",
            steps: [
              "Pick the car.",
              "Press Add Cost under Recon Costs.",
              "Choose Parts or Labour as the Cost Type and enter the Amount, VAT and Supplier.",
              "Press Save Cost.",
            ],
          },
          {
            question: "How do I find a part for a car?",
            steps: [
              "Pick the car.",
              "Press eBay Motors to search with its registration, or Euro Car Parts or GSF Car Parts and type the registration there.",
            ],
          },
        ],
        tips: ["Only parts and labour costs are listed here. The car's Costs tab shows everything logged against it."],
        access: "For the owner, managers and finance, because it reads and writes costs in your books.",
      },
    },

    // ------------------------------------------------------------------
    {
      id: "pricing-workflow",
      title: "Pricing workflow",
      route: car(id => `/dealer/workflow/pricing/${id}`),
      steps: [
        {
          id: "pricing-workflow-header",
          target: "css:main header",
          title: "Pricing a car",
          narration:
            "The pricing workflow puts one car's price next to what it cost you. Open the vehicle takes you back to its full page. You'll also land here from the dashboard when a car has no asking price.",
        },
        {
          id: "pricing-workflow-figures",
          target: "css:main dl",
          title: "Your price and costs",
          narration:
            "Here's your asking price, what the car cost, the costs logged against it, the total so far, and your margin at the asking price. It's plain arithmetic on your own figures, before VAT, not a valuation. The cost figures are for the owner, managers and finance.",
        },
        {
          id: "pricing-workflow-next",
          target: "css:main .space-y-10 > :last-child",
          title: "Next steps",
          narration:
            "From here, Photos Workflow opens Photo Studio and MOT Workflow opens the car's MOT record. If you look after the money, Recon Workflow is here too, for logging the preparation work and its cost.",
        },
      ],
      guide: {
        summary:
          "The pricing workflow shows one car's asking price against what it cost and what has been spent on it, so you can see your margin before you change the price. It's arithmetic on your own figures, not a market valuation.",
        howTo: [
          {
            question: "How do I change the asking price?",
            steps: ["Press Open the vehicle.", "Open the Edit tab.", "Change Retail Price (£) and press Save Vehicle."],
          },
          {
            question: "Why does it say what it cost is not recorded?",
            steps: [
              "The car has no purchase in Bookkeeping and no trade price.",
              "Press Add the purchase and record what you paid.",
              "Come back, and the total cost and margin fill in.",
            ],
          },
          {
            question: "How do I compare with the market?",
            steps: ["Press Open the vehicle.", "Open the Market pricing tab to see similar dealer listings."],
          },
        ],
        tips: ["The margin here is before VAT and before any cost you haven't logged yet."],
        access:
          "What the car cost, its costs, the margin and the Recon Workflow button are for the owner, managers and finance.",
      },
    },

    // ------------------------------------------------------------------
    // A money page (pageAccess), so only the owner, managers and finance get it.
    {
      id: "recon-workflow",
      title: "Recon workflow",
      route: car(id => `/dealer/workflow/recon/${id}`),
      steps: [
        {
          id: "recon-workflow-summary",
          target: "css:main .max-w-5xl > :nth-child(2)",
          title: "Recon at a glance",
          narration:
            "This is the preparation work on one car and what it has cost. The summary shows the total and how many items, and once you've sold enough cars, your average spend per sold car to compare it against.",
        },
        {
          id: "recon-workflow-add",
          target: "css:main .max-w-5xl > :nth-child(4)",
          title: "Logging a job",
          narration:
            "To log a job, type what was done and the cost, then press Add. If you used something from your Consumables stock, tick the box and pick it, and I'll take the quantity out of stock for you. It all goes into your books against this car.",
        },
        {
          id: "recon-workflow-items",
          target: "css:main .max-w-5xl > :nth-child(6)",
          title: "What's been done",
          narration:
            "Every cost logged against this car is listed here, including ones added in Bookkeeping, with its date and how much stock is left. Remove takes one off straight away, without asking, and puts back any stock it used, so use it with care.",
        },
      ],
      guide: {
        summary:
          "Recon Workflow logs the preparation work on one car and what it cost, straight into your books. It can take parts out of your Consumables stock as you use them.",
        howTo: [
          {
            question: "How do I log work on a car?",
            steps: ["Type what was done in Recon Item.", "Enter the Cost (£).", "Press Add."],
          },
          {
            question: "How do I use a part from stock?",
            steps: [
              "Tick Use a real item from Consumables stock.",
              "Choose the stock item.",
              "Enter the Quantity Used and the Cost (£).",
              "Press Add, and the quantity comes out of stock.",
            ],
          },
          {
            question: "How do I fix a mistake?",
            steps: [
              "Find the item in the list.",
              "Press Remove.",
              "If it used stock, the quantity goes back into Consumables.",
            ],
          },
        ],
        tips: [
          "Recon costs are saved with no VAT. If a job had VAT you can reclaim, log it with Add Cost on the car's Costs tab instead.",
        ],
      },
    },
  ],
};
