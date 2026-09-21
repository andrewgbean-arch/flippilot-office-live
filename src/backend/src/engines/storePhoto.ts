// The one picture a car's card shows on the public store page.
//
// It follows the Car Passport's rules for what may be shown to a stranger
// (carPassport.ts: passportImages): a normal https address, or a photo this
// system hosts itself. Nothing else is ever passed on: not a "javascript:" or
// "file:" address, not plain http, not an SVG, not a non-image.
//
// One more rule, because the store lists EVERY car in one response: a picture
// embedded in the record itself (a "data:" address, which can be hundreds of
// kilobytes) is left out here, so the store page stays small however many cars
// there are. A car with only embedded pictures simply shows none on the store;
// its Car Passport page still shows them.

import { passportImages } from "./carPassport";

export function storePhoto(images: unknown): string | undefined {
  return passportImages(images).find(url => !url.startsWith("data:"));
}
