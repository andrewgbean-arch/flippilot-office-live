// The "Money and finance" chapter of the guided tour: the books, one car's
// ledger, where the cars come from, and the finance calculators. Every line
// must be true of the screens as they are (see tourPlan.ts for the types).
//
// Bookkeeping, a car's ledger and Profit Breakdown are for the owner, managers
// and finance: pageAccess.ts leaves them out for everyone else. The finance
// calculators are open to everyone and are illustrations, never quotes.

import type { TourChapter, TourRouteContext } from "../tourPlan";

const car = (path: (id: string) => string) => (ctx: TourRouteContext) => (ctx.firstVehicleId ? path(ctx.firstVehicleId) : null);

export const chapter: TourChapter = {
  id: "money",
  title: "Money and finance",
  blurb: "Your books, each car's ledger, and the finance calculators for the forecourt.",
  pages: [
    // ------------------------------------------------------------------
    {
      id: "bookkeeping",
      title: "Bookkeeping",
      route: "/bookkeeping",
      steps: [
        {
          id: "bookkeeping-intro",
          target: "tour-bookkeeping",
          title: "Your books",
          narration:
            "This is your Bookkeeping Hub: every car you've bought, what you've spent on it, what it sold for and the profit. Only the owner, managers and finance can open it, and our server refuses the figures to everyone else, not just this screen.",
        },
        {
          id: "bookkeeping-buy-cost",
          target: "tour-bookkeeping-actions",
          title: "Buying and spending",
          narration:
            "Add Purchase records a car you've bought, with its price, VAT scheme and where it came from, and adds the car to your stock at the same time. Add Cost logs money spent on any car, like parts, transport or an MOT, with its VAT. Tick credit or refund for money back.",
        },
        {
          id: "bookkeeping-sale-transaction",
          target: "button:Add Sale",
          title: "Sales and running costs",
          narration:
            "Add Sale records a car going out: pick it, enter the price and the buyer, and I mark it sold in stock and give it the next invoice number. Add Transaction is for money not tied to one car, like rent or insurance. They're listed further down, under Other income and expenses.",
        },
        {
          id: "bookkeeping-summary",
          target: "css:main .lg\\:grid-cols-4",
          title: "The headline figures",
          narration:
            "Total spent is every purchase and cost, sold or not. Profit and margin count only cars you've sold, each one's sale price less what it cost you. If a sold car has no purchase price, I leave it out and say so rather than guess. The last tile counts cars still to sell.",
        },
        {
          id: "bookkeeping-ledger",
          target: "heading:Acquisition Ledger",
          title: "The ledger",
          narration:
            "Each row is one car: what you paid, its total costs, the sale price, profit, margin and the VAT due on the sale, marked Margin or Standard. A dash means not recorded yet, never zero. Click any row to open that car's own ledger.",
        },
        {
          id: "bookkeeping-cost-breakdown",
          target: "heading:Cost Breakdown",
          title: "Where the money goes",
          narration:
            "Cost Breakdown adds up every cost you've logged by type, so you can see at a glance what parts, labour, transport or detailing are costing you across all your cars.",
        },
        {
          id: "bookkeeping-sources",
          target: "heading:Purchase Sources",
          title: "Who you pay",
          narration:
            "Purchase Sources totals your spend by name, counting both the cars you bought from each place and the costs you logged against a supplier. For profit by source, use View Full Purchase Source Analytics underneath.",
        },
      ],
      guide: {
        summary:
          "The Bookkeeping Hub is your books for the cars you buy and sell: purchases, costs, sales and the profit on each car you've sold. Profit is only worked out for a car with a recorded purchase price and a sale, so anything missing shows as a dash, never as zero.",
        howTo: [
          {
            question: "How do I record a car I've just bought?",
            steps: [
              "Click Add Purchase.",
              "Enter the Make and Model, and the Registration if you have it.",
              "Type the Purchase Price and choose the VAT Scheme: Margin Scheme for most used cars bought with no VAT invoice, Standard VAT if you got one.",
              "Fill in Purchased From and the Date.",
              "Click Save Purchase. The car is added to your stock as well as your books.",
            ],
          },
          {
            question: "How do I log a cost against a car?",
            steps: [
              "Click Add Cost.",
              "Pick the car under Vehicle and choose the Cost Type.",
              "Enter the Amount, then set VAT Rate, VAT Included? and VAT Reclaimable?.",
              "For money back from a supplier, tick This is a credit or refund instead of typing a minus sign.",
              "Add the Supplier and any Notes, then click Save Cost.",
            ],
          },
          {
            question: "How do I record a sale?",
            steps: [
              "Click Add Sale.",
              "Pick the car under Vehicle and enter the Sale Price.",
              "Check the VAT Rate. A Margin Scheme car shows the VAT due on the margin; a Standard VAT car asks whether the price includes VAT.",
              "Add the Buyer Name, and their email if you'll want to email the invoice.",
              "Click Save Sale. The car is marked sold in stock and gets the next invoice number.",
            ],
          },
          {
            question: "How do I record rent, insurance or other running costs?",
            steps: [
              "Click Add Transaction.",
              "Choose Expense or Income and type a Category.",
              "Enter the Amount, the Date and any Notes, then click Save Transaction.",
            ],
          },
        ],
        tips: [
          "Click any row in the ledger to see that car's purchase, costs, sale, profit and invoice.",
          "Transactions are listed under Other income and expenses. They belong to the business, so they aren't counted in any car's profit.",
          "The VAT figures are a working guide: check your VAT return with your accountant.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "bookkeeping-car",
      title: "A car's ledger",
      route: car(id => `/bookkeeping/entry/${id}`),
      steps: [
        {
          id: "bookkeeping-car-intro",
          target: "heading:Vehicle Ledger",
          title: "One car's books",
          narration:
            "This is one car's own ledger: everything the books hold about it on a single page, from the day you bought it to the day it sold. You get here by clicking a row on the Bookkeeping Hub.",
        },
        {
          id: "bookkeeping-car-purchase",
          target: "heading:Purchase",
          title: "What it cost",
          narration:
            "Purchase shows the price you paid, where the car came from and the date. A Margin Scheme car shows no VAT, because there's none to reclaim. If the price was never recorded, a Record purchase price button appears here, so the profit can be worked out.",
        },
        {
          id: "bookkeeping-car-costs",
          target: "heading:Costs",
          title: "Costs on this car",
          narration:
            "Every cost logged against this car is listed with its supplier, VAT and net amount, with the total underneath. Add Cost logs another. Delete cost removes one after asking you first. A cost raised against parts stock is removed from the Recon screen instead, so the parts go back.",
        },
        {
          id: "bookkeeping-car-sale",
          target: "heading:Sale",
          title: "The sale",
          narration:
            "When the car sells, click Record Sale to enter the price and the buyer. After that, this card shows the invoice number, the buyer, the VAT and the net amount, with Edit Sale to put anything right.",
        },
        {
          id: "bookkeeping-car-invoice",
          target: "heading:Sale",
          title: "The invoice",
          narration:
            "Once a sale is recorded, View / Print Invoice opens a proper invoice with your business details. A Margin Scheme invoice shows no separate VAT, as the scheme's rules require. Print / Save as PDF prints it, and Email to Customer opens your own email app with the details filled in.",
        },
        {
          id: "bookkeeping-car-profit",
          target: "heading:Profit Summary",
          title: "Profit on this car",
          narration:
            "Profit Summary is the sale price less the purchase price and every cost. Until the car has both a real purchase price and a sale, it shows a dash and tells you what's missing, rather than a made-up figure.",
        },
        {
          id: "bookkeeping-car-timeline",
          target: "heading:Timeline",
          title: "The car's history",
          narration:
            "Timeline lists what happened to this car in order: when it was bought, each cost as it was added, and when it sold. It's a quick way to see how long a car took to turn.",
        },
      ],
      guide: {
        summary:
          "A car's ledger shows everything the books hold about one car: its purchase, each cost, the sale, the profit and the invoice. Open it by clicking the car's row on the Bookkeeping Hub.",
        howTo: [
          {
            question: "How do I print or email an invoice?",
            steps: [
              "Record the sale first, with the buyer's email if you want to email it.",
              "Click View / Print Invoice on the Sale card.",
              "Click Print / Save as PDF to print it or keep a copy.",
              "Or click Email to Customer: your own email app opens with the invoice details written in, ready for you to send.",
            ],
          },
          {
            question: "How do I fix a car whose purchase price says Not recorded?",
            steps: [
              "On the Purchase card, click Record purchase price.",
              "Enter what the car really cost.",
              "Click Save Purchase Price. The profit, and the VAT on a Margin Scheme sale, are worked out straight away.",
            ],
          },
          {
            question: "How do I correct a sale?",
            steps: ["Click Edit Sale on the Sale card.", "Change the price, VAT details, buyer or date.", "Click Update Sale."],
          },
          {
            question: "How do I remove a cost entered by mistake?",
            steps: [
              "Find it under Costs and click Delete cost.",
              "Confirm when asked. The car's profit changes straight away.",
              "If it says Raised against stock, remove it from the Recon screen instead, so the parts go back into stock.",
            ],
          },
        ],
        tips: [
          "Email to Customer doesn't attach a PDF: it writes the invoice details into the email. Save the PDF and attach it yourself if the customer needs one.",
          "Emptying the buyer's email or phone on Edit Sale won't clear it. Type the new details over the old ones instead.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "purchase-sources",
      title: "Purchase Source Analytics",
      route: "/bookkeeping/suppliers",
      steps: [
        {
          id: "purchase-sources-intro",
          target: "heading:Purchase Source Analytics",
          title: "Where cars come from",
          narration:
            "Purchase Source Analytics compares the places you buy from, like each auction, part exchanges and private buys, so you can see where your best cars come from. Sources are named by what you type in Purchased From, so keep the spelling the same.",
        },
        {
          id: "purchase-sources-ranking",
          target: "css:main .max-w-5xl",
          title: "Best first",
          narration:
            "Each card here is one source, showing how many cars you've bought there. They're listed with the highest total profit first, so your best source sits at the top.",
        },
        {
          id: "purchase-sources-figures",
          target: "css:main div.cursor-pointer",
          title: "Reading the figures",
          narration:
            "Total Spend and Avg Buy are what you paid. Profit here is rough: each car's sale price, or its asking price if it's still in stock, less what you paid, without prep costs. VAT Impact is the VAT on Standard VAT purchases. Click a card to see its cars.",
        },
      ],
      guide: {
        summary:
          "Purchase Source Analytics groups your purchases by where you bought them and compares spend and profit for each source. The profit here is a quick guide: it uses the asking price for cars still in stock and doesn't take off prep costs.",
        howTo: [
          {
            question: "How do I see the cars that came from one source?",
            steps: [
              "Click that source's card.",
              "The source's own page shows its totals and every car bought there.",
              "Click a car to open it in stock.",
            ],
          },
          {
            question: "Why is one source showing twice?",
            steps: [
              "Sources are grouped by exactly what was typed in Purchased From, so different spellings show separately.",
              "Type each source the same way every time you use Add Purchase.",
            ],
          },
        ],
        tips: [
          "For a car's true profit after prep costs, open its ledger from the Bookkeeping Hub.",
          "Cars still in stock count at their asking price here, so these figures move when you reprice.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "profit-breakdown",
      title: "Profit Breakdown",
      route: "/dealer/finance/profit-breakdown",
      steps: [
        {
          id: "profit-breakdown-intro",
          target: "heading:Profit Breakdown",
          title: "A quick profit check",
          narration:
            "Profit Breakdown is a calculator for what a car makes after costs and VAT. It doesn't read your books or save anything, so it's handy for a car you're thinking of buying or pricing. The VAT figure is a guide to check with your accountant.",
        },
        {
          id: "profit-breakdown-figures",
          target: "css:main .sn-form",
          title: "Your figures",
          narration:
            "Type the purchase price, reconditioning, parts and labour, any other costs, and the price you expect to sell for. Blank cost boxes simply count as none. I need at least the purchase and sale prices before I show a profit.",
        },
        {
          id: "profit-breakdown-vat",
          target: "css:#profitbreakdown-vat-treatment",
          title: "The VAT treatment",
          narration:
            "Choose how VAT applies. The margin scheme takes a sixth of the sale price less the purchase price, and prep costs don't reduce it. Standard treats the sale price as including 20 percent VAT. Or take no VAT off if you're not VAT registered.",
        },
        {
          id: "profit-breakdown-result",
          target: "heading:Breakdown",
          title: "The breakdown",
          narration:
            "The breakdown shows your total costs, the gross profit before VAT, the VAT due, and the net profit after VAT in green or red. Margin is the gross profit as a share of the sale price.",
        },
      ],
      guide: {
        summary:
          "Profit Breakdown is a what-if calculator: type a car's costs and sale price and it shows the gross profit, the VAT due and the net profit. It doesn't use or change your books, and nothing you type is saved.",
        howTo: [
          {
            question: "How do I check the profit on a car I'm pricing?",
            steps: [
              "Enter the Purchase Price.",
              "Add the Reconditioning Cost, Parts & Labour and Other Costs, leaving blank any you don't have.",
              "Enter the Sale Price you're aiming for.",
              "Choose the VAT treatment.",
              "Read the net profit at the bottom of the breakdown.",
            ],
          },
          {
            question: "Which VAT treatment should I pick?",
            steps: [
              "The VAT margin scheme for a used car bought with no VAT invoice, which is most of them.",
              "Standard 20% VAT for a car bought with a VAT invoice.",
              "No VAT taken off if you're not VAT registered.",
              "Check anything you're unsure of with your accountant.",
            ],
          },
        ],
        tips: ["For a car you've already sold, its real profit is on its ledger in Bookkeeping."],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "finance-calculator",
      title: "Finance Calculator",
      route: "/dealer/finance/calculator",
      steps: [
        {
          id: "finance-calculator-intro",
          target: "heading:Finance Calculator",
          title: "Monthly payments",
          narration:
            "The Finance Calculator gives an illustrative monthly payment from figures you type. It isn't a finance quote or a credit offer: the lender's own agreement sets the real APR and payments. It's for giving a customer a rough idea on the forecourt.",
        },
        {
          id: "finance-calculator-inputs",
          target: "css:main div.backdrop-blur-xl:has(input)",
          title: "What to type",
          narration:
            "Enter the vehicle price, the deposit, the term in months and the APR you've actually been quoted. I never fill in a rate for you, so there's no payment until you've typed one.",
        },
        {
          id: "finance-calculator-result",
          target: "css:main div.backdrop-blur-xl:not(:has(input))",
          title: "The illustration",
          narration:
            "Here's the monthly payment, with the amount financed, the total repayable and the interest. It assumes equal monthly payments and no fees, so a real agreement can differ.",
        },
      ],
      guide: {
        summary:
          "The Finance Calculator works out an illustrative monthly payment from a price, deposit, term and APR you type in. It is not a finance quote or a credit offer: finance is subject to status and the lender's agreement sets the real figures.",
        howTo: [
          {
            question: "How do I show a customer a monthly payment?",
            steps: [
              "Enter the Vehicle Price and the Deposit.",
              "Set the Term (months).",
              "Type the APR (%) the lender quoted you.",
              "Read the monthly payment, total repayable and interest underneath.",
            ],
          },
        ],
        tips: [
          "Always tell the customer the figure is illustrative.",
          "To compare several lenders side by side, use Lender Comparison.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "deal-sheet",
      title: "Deal Sheet",
      route: "/dealer/finance/deal-sheet",
      steps: [
        {
          id: "deal-sheet-intro",
          target: "heading:Deal Sheet",
          title: "Putting a deal together",
          narration:
            "The Deal Sheet puts a whole deal on one page: the car, the price, a trade-in, the deposit and an illustrative monthly payment. It's a working summary, not a finance quote, and nothing on it is saved.",
        },
        {
          id: "deal-sheet-figures",
          target: "css:main .sn-form",
          title: "The figures",
          narration:
            "Pick the customer from your leads, type the vehicle, then the sale price, trade-in value, deposit, term and the APR you've been quoted. Leave the APR blank and there's simply no monthly payment shown.",
        },
        {
          id: "deal-sheet-summary",
          target: "heading:Summary",
          title: "The summary",
          narration:
            "The summary takes the trade-in and deposit off the price to give the balance to finance, then shows the monthly payment, the interest and the total payable. If the trade-in and deposit come to more than the price, I show the difference.",
        },
      ],
      guide: {
        summary:
          "The Deal Sheet builds a one-page summary of a deal: the customer, the car, the price, any trade-in and deposit, and an illustrative monthly payment. It isn't a finance quote, and nothing on it is saved.",
        howTo: [
          {
            question: "How do I build a deal for a customer?",
            steps: [
              "Choose the customer under Customer / Lead.",
              "Type the Vehicle and the Sale Price.",
              "Enter the Trade-In Value and the Deposit, if there are any.",
              "Set the Finance Term (months) and type the APR (%) you were quoted.",
              "Read the balance to finance, monthly payment and total payable in the summary.",
            ],
          },
        ],
        tips: [
          "Nothing on the Deal Sheet is saved, so note the figures before you leave the page.",
          "For a trade-in figure to start from, use Trade-In Valuation first.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "lender-comparison",
      title: "Lender Comparison",
      route: "/dealer/finance/lender-comparison",
      steps: [
        {
          id: "lender-comparison-intro",
          target: "heading:Lender Comparison",
          title: "Comparing lenders",
          narration:
            "Lender Comparison puts the quotes you've had from different lenders side by side. Nothing is filled in for you: you type each lender and the rate they gave you, and the payments are illustrative only.",
        },
        {
          id: "lender-comparison-amount",
          target: "css:main .sn-form",
          title: "Amount and term",
          narration:
            "First enter the loan amount and the term in months. Every lender card below uses these same figures, so you're always comparing like with like.",
        },
        {
          id: "lender-comparison-add",
          target: "button:Add a lender",
          title: "Adding lenders",
          narration:
            "Click Add a lender for each quote, then type the lender's name and APR. Each card shows its monthly payment and total repayable, and once there are two different rates, the cheapest is marked Lowest monthly payment. Remove takes a card away.",
        },
      ],
      guide: {
        summary:
          "Lender Comparison shows the monthly payment and total repayable for each lender quote you type in, using the same loan amount and term for all of them. Nothing is pre-filled and nothing is saved.",
        howTo: [
          {
            question: "How do I compare finance quotes?",
            steps: [
              "Enter the Loan Amount (£) and the Term (months).",
              "Click Add a lender.",
              "Type the lender's name and the APR they quoted.",
              "Repeat for each quote you have.",
              "Compare the monthly payments and totals on the cards.",
            ],
          },
        ],
        tips: [
          "The lowest monthly payment isn't always the best deal: check fees, the total repayable and the terms.",
          "Nothing here is saved, so note the figures before you leave the page.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "trade-in",
      title: "Trade-In Valuation",
      route: "/dealer/finance/trade-in",
      steps: [
        {
          id: "trade-in-intro",
          target: "heading:Trade-In Valuation",
          title: "A starting offer",
          narration:
            "Trade-In Valuation gives you a rule-of-thumb starting point for an offer, worked out from a market value you type in. It doesn't look the car up or value it: your own appraisal always comes first.",
        },
        {
          id: "trade-in-car",
          target: "css:main .sn-form",
          title: "The car and its value",
          narration:
            "Type the make and model, then a market value from a valuation guide or listings you trust. Everything underneath is worked out from that one figure, so it's only as good as the value you put in.",
        },
        {
          id: "trade-in-condition",
          target: "css:#tradeinvaluation-condition",
          title: "Condition and margin",
          narration:
            "Choosing a condition sets a starting allowance off the market value: nothing for excellent, five percent for good, 12 for fair and 22 for poor. It's a rule of thumb, so change it to suit the car. Then set your own margin, which starts at ten percent.",
        },
        {
          id: "trade-in-finance",
          target: "css:#tradeinvaluation-outstanding-finance",
          title: "Outstanding finance",
          narration:
            "If the customer still owes finance on the car, enter it here. I'll show whether your offer clears it and how much is left to pay the customer, or how far short it falls.",
        },
        {
          id: "trade-in-result",
          target: "heading:Valuation",
          title: "The suggested offer",
          narration:
            "The valuation shows the market value, each amount taken off, and the suggested offer, all marked illustrative. Use it to start the conversation, not as a price you've committed to. Nothing here is saved.",
        },
      ],
      guide: {
        summary:
          "Trade-In Valuation turns a market value you type in into a suggested starting offer, taking off a condition allowance and your margin, and checking it against any outstanding finance. It is a rule of thumb, not a valuation, and it doesn't look the car up.",
        howTo: [
          {
            question: "How do I work out a trade-in offer?",
            steps: [
              "Type the Make and Model.",
              "Enter the Market Value (£) from a guide or listings you trust.",
              "Choose the Condition, then adjust the condition allowance if the car needs it.",
              "Set Your margin.",
              "Enter any Outstanding Finance (£).",
              "Read the suggested offer, and what's left for the customer after the finance, in the valuation.",
            ],
          },
        ],
        tips: [
          "Always see the car before you commit: this screen knows only the figures you give it.",
          "If the finance owed is more than your offer, the shortfall shows in red.",
        ],
      },
    },

    // ------------------------------------------------------------------
    {
      id: "contract",
      title: "Contract Generator",
      route: "/dealer/finance/contract",
      steps: [
        {
          id: "contract-intro",
          target: "heading:Contract Generator",
          title: "Sale agreements",
          narration:
            "The Contract Generator fills in a vehicle sale agreement template for you to print or save as a PDF. Nothing you type is saved, so print it before you leave the page.",
        },
        {
          id: "contract-notice",
          target: "css:main [role=note]",
          title: "Read this first",
          narration:
            "Please read this box. The template hasn't been checked by a solicitor and isn't legal advice. A consumer's rights under the Consumer Rights Act can't be signed away, whatever the agreement says, so have it checked before you rely on it.",
        },
        {
          id: "contract-details",
          target: "css:main .sn-form",
          title: "The details",
          narration:
            "Fill in your business name, your address and your VAT number if you have one. Pick the buyer from your leads, then add the vehicle, registration, VIN, mileage, sale price and deposit. The buyer's name and phone or email come from the lead.",
        },
        {
          id: "contract-terms",
          target: "css:#contractgenerator-warranty-terms-only-if-you-are-giving-one",
          title: "Warranty and terms",
          narration:
            "Only write warranty terms you've actually agreed to give, and leave the box blank if there's no warranty. Other terms is for your own conditions. I never fill in either box for you.",
        },
        {
          id: "contract-preview",
          target: "heading:Contract Preview",
          title: "The preview",
          narration:
            "The preview updates as you type. Anything left blank prints as a line to fill in by hand, the balance due on collection is worked out for you, and there's space for both signatures.",
        },
        {
          id: "contract-print",
          target: "button:Print / Save as PDF",
          title: "Printing it",
          narration:
            "Print / Save as PDF opens your browser's print window. Choose your printer, or save it as a PDF to keep a copy or send it on yourself.",
        },
      ],
      guide: {
        summary:
          "The Contract Generator fills in a vehicle sale agreement template from details you type, ready to print or save as a PDF. It is a starting template, not legal advice, and nothing you type is saved.",
        howTo: [
          {
            question: "How do I make a sale agreement?",
            steps: [
              "Fill in your business name, address and VAT number if you have one.",
              "Choose the buyer under Customer / Lead.",
              "Type the Vehicle, Registration, VIN / chassis number and Mileage at sale.",
              "Enter the Sale Price (£) and any Deposit Paid (£).",
              "Add warranty terms only if you're giving one, and any other terms of your own.",
              "Check the Contract Preview, then click Print / Save as PDF.",
            ],
          },
        ],
        tips: [
          "Have the template checked by a solicitor before you rely on it.",
          "A buyer who isn't in your leads prints as a blank line, to fill in by hand.",
          "Nothing is saved, so print or save the PDF before you leave the page.",
        ],
      },
    },
  ],
};
