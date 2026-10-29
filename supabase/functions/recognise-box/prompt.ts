// What the model is asked about a photo of a medicine box (docs/model.md, "A
// photo of the box"). Two shots: the front, with the name, and the flap, with
// the expiry. The answer is a query for the Register search, never the
// medicine itself: the phone checks every key and the person confirms the
// entry it finds.

import { MEDICINE_FORMS } from '../../../src/domain/medicine.ts';

export type BoxSide = 'front' | 'flap';

const EXPIRY = `"expires": the expiry as "YYYY-MM", or null. It is printed as «Придатний до», «Термін придатності до», «Вжити до», «EXP», «Годен до» or just a date next to a batch number («Серія», «Lot»), as 05.2027, 05/27, 31.05.2027 or 2027-05. Never the date the pack was made («Дата виготовлення», «MFG», «Виготовлено»). A two-digit year is 20YY. With a day, keep only the month.`;

const FRONT = `This is a photo of a medicine box, the side with its name. Read what is printed on it and answer with JSON only, in this shape:

{
  "name": the trade name as printed, with what belongs to it («Нурофен Форте», «Нурофен для дітей», «Називін»), without the strength, the form or the pack size; or null,
  "inn": the active substance or substances as printed, in Ukrainian if they are there in Ukrainian, otherwise in Latin, joined with « + »; or null,
  "strength": the strength as printed, with its units («200 мг», «100 мг/5 мл», «0,05 %», «500 МО»), or null,
  "form": what the medicine is, one of ${MEDICINE_FORMS.map((f) => `"${f}"`).join(', ')}, or null. Pastilles, lozenges and effervescent tablets are "tablets"; nasal and throat sprays are "spray"; a gel or cream is "ointment"; sachets of powder or granules are "powder"; "other" only when it is none of them,
  "packSize": how many are in the pack as a number: tablets, capsules, sachets or suppositories, or millilitres or grams for a liquid, a gel or a powder in bulk; or null,
  "manufacturer": the company that made it, as printed, or null,
  "barcode": the digits under the barcode, if there is one and every digit can be read, otherwise null,
  ${EXPIRY} Only if the expiry is on this side too,
  "unsure": the names of the keys above whose value you guessed from a blurred, cut or partly hidden print
}

Take only what is printed; never fill a key from what you know about the medicine. Text in Ukrainian stays in Ukrainian; keep its letters and case as on the box, but write the name in title case if the box prints it in capitals. If the photo is not of a medicine box, answer {"notABox": true}.`;

const FLAP = `This is a photo of the flap or the side of a medicine box, where the batch and the expiry are pressed or printed. Answer with JSON only, in this shape:

{
  ${EXPIRY}
  "unsure": ["expires"] if you guessed any digit of it from a blurred or pressed print, otherwise []
}

If the photo is not of a medicine box, answer {"notABox": true}.`;

export const BOX_PROMPTS: Record<BoxSide, string> = { front: FRONT, flap: FLAP };
