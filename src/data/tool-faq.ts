import type { FaqItem } from './faq';


export const TOOL_FAQ: FaqItem[] = [
  {
    question: 'What’s the quickest way to compare two packs?',
    answer:
      'Type both into the box at the top in any order, for example “2kg for 210, 1.5kg for 189” or “Rs 210 - 2 kg | Rs 189 - 1.5 kg”. CheaperPack finds each price and quantity, fills in the products and shows the better buy straight away. You can also fill in the price and quantity fields yourself.',
  },
  {
    question: 'Is my photo uploaded when I scan a price tag?',
    answer:
      'No. The scanner reads the photo on your own device, inside your browser, and the image is never sent anywhere. The first time you open the scanner it downloads the reading engine (about 13 MB), which your browser keeps for next time.',
  },
  {
    question: 'What if the scanner reads something wrong?',
    answer:
      'Everything it finds appears in editable fields before it’s added, along with any other prices or sizes it spotted, so you can fix a mistake with one tap or by typing. If it can’t read the photo at all, you can type the details straight away.',
  },
  {
    question: 'Which price does it use when a tag shows MRP and an offer price?',
    answer:
      'It uses the price you would pay: a labelled offer or sale price first, then an unlabelled price, and the MRP only if nothing else is shown. The other prices are offered as one-tap alternatives. Unit prices like “₹39.80/100 g” and savings like “save ₹30” are never taken as the pack price.',
  },
  {
    question: 'Can I compare multipacks and offers like “2 for ₹100”?',
    answer:
      'Yes. Write multipacks as “6 x 330 ml” and multi-buy offers as “200g 2 for 100”. CheaperPack multiplies them out, so 2 × 200 g for ₹100 is compared as 400 g for ₹100.',
  },
  {
    question: 'Why won’t it compare kilograms with millilitres?',
    answer:
      'Kilograms measure weight and millilitres measure volume. Turning one into the other needs the product’s density, which CheaperPack won’t guess. Grams and kilograms are compared with each other, millilitres and litres with each other, and pieces with pieces.',
  },
  {
    question: 'Which units can I use?',
    answer:
      'Grams, kilograms, millilitres, litres and pieces, plus ounces, pounds and US fluid ounces. Weight is only compared with weight, volume with volume and pieces with pieces. Ounces (weight) and fluid ounces (volume) are never mixed.',
  },
  {
    question: 'Does it convert between currencies?',
    answer:
      'No. Enter every price in the same currency. The currency setting only changes the symbol and formatting.',
  },
  {
    question: 'Are my comparisons saved?',
    answer:
      'Your recent comparisons are kept in this browser only, so you can reopen them later; “Clear” removes them. A shared link carries the prices in the part of the address after the “#”, which browsers don’t send to the server.',
  },
];
