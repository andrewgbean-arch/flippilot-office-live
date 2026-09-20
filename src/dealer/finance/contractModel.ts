import { toAmount, type AmountInput } from "./money";

// The wording and sums behind the Contract Generator.
//
// This screen used to pre-fill the terms box with "This vehicle is sold with
// a valid MOT and 3 months warranty unless otherwise stated. Buyer confirms
// they have inspected the vehicle prior to purchase." That is a warranty
// promise the dealer had not made, and an inspection clause that cannot take
// away a consumer's statutory rights (the Consumer Rights Act 2015 makes such
// a term not binding on a consumer). Nothing here is pre-filled any more:
// what the dealer promises is what the dealer types.

export const CONTRACT_NOTICE_TITLE = "A starting template, not legal advice";

export const CONTRACT_NOTICE_LINES: readonly string[] = [
  "This is a starting template. It has not been checked by a solicitor and it is not legal advice. Have it checked before you use it.",
  "If you sell to a consumer, the Consumer Rights Act 2015 gives the buyer rights that apply whatever this document says and cannot be signed away: the vehicle must be of satisfactory quality, fit for its purpose and as described. A term that tries to take them away is not binding on the buyer.",
  "Only write down warranty terms you have actually agreed to give. Nothing is filled in for you.",
];

/** Printed on the agreement itself. It states the law; it adds no promise from the dealer. */
export const CONTRACT_STATUTORY_RIGHTS_LINE = "Nothing in this agreement affects the buyer's statutory rights.";

export interface ContractFigures {
  /** Null while the sale price is blank. */
  salePrice: number | null;
  /** A blank deposit means none was taken. */
  deposit: number;
  /** Sale price minus deposit. Null while the price is blank or the deposit is more than the price. */
  balance: number | null;
  depositExceedsPrice: boolean;
}

export function contractFigures(salePrice: AmountInput, deposit: AmountInput): ContractFigures {
  const price = toAmount(salePrice);
  const paid = toAmount(deposit) ?? 0;
  const exceeds = price !== null && paid > price;
  return {
    salePrice: price,
    deposit: paid,
    balance: price === null || exceeds ? null : price - paid,
    depositExceedsPrice: exceeds,
  };
}
