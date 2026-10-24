export interface FaqItem {
  question: string;
  /** Plain-text answer (also used for structured data). */
  answer: string;
}

export const FAQ: FaqItem[] = [
  {
    question: 'What is a unit price?',
    answer:
      'A unit price is what a product costs per standard amount, such as per kilogram, per litre, per ounce or per item. It lets you compare packs of different sizes on equal terms: divide the price by the size, after putting both sizes in the same unit.',
  },
  {
    question: 'Is the bigger pack always cheaper?',
    answer:
      'No. Larger packs are often cheaper per unit, but not always: promotions on small packs, multipack pricing and changes in pack sizes can all make a smaller pack the better deal. Comparing unit prices shows you which is cheaper for the amount you get.',
  },
  {
    question: 'Why can’t I compare grams with millilitres?',
    answer:
      'Grams measure weight and millilitres measure volume. Converting one into the other needs the product’s density, which differs from product to product (a litre of honey weighs much more than a litre of crisps). CheaperPack never guesses a density, so it asks you to use the same kind of unit for every product. Many packs show both weight and volume; use whichever both labels share.',
  },
  {
    question: 'Can I compare prices in different currencies?',
    answer:
      'No. CheaperPack doesn’t use exchange rates, so every price you enter must be in the same currency. Changing the currency setting only changes how amounts are displayed; it doesn’t convert them.',
  },
  {
    question: 'Does CheaperPack know shop prices?',
    answer:
      'No. CheaperPack only works with the prices you type in. It doesn’t look up, store or track shop prices. The example values you can fill in are made up to show how the tool works; they are not real prices from any shop.',
  },
  {
    question: 'How do I enter a multipack or a “2 for” offer?',
    answer:
      'Enter the total price you pay and the total amount you get. For 6 cans of 330 ml for 5.49, enter 5.49 and 1980 ml (6 × 330). On a keyboard you can also type 6x330 in the size field and CheaperPack multiplies it for you. For “2 for 3.00” on 500 g packs, enter 3.00 and 1000 g.',
  },
  {
    question: 'What’s the difference between oz and fl oz?',
    answer:
      'Ounces (oz) measure weight: 1 oz is 28.35 g. Fluid ounces (fl oz) measure volume, and the US and UK versions differ: 1 US fl oz is 29.57 ml and 1 UK fl oz is 28.41 ml. Check which one the label uses. CheaperPack treats oz as weight and fl oz as volume, so it won’t compare them with each other.',
  },
  {
    question: 'Should I type decimals with a comma or a dot?',
    answer:
      'Either works: 3.49 and 3,49 are both read as three point four nine. If you type a separator followed by exactly three digits, such as 1,500, CheaperPack follows your browser’s language settings to decide whether you mean one and a half or fifteen hundred. The result shows each size as it was read, so you can check.',
  },
  {
    question: 'How precise are the results?',
    answer:
      'CheaperPack calculates with the exact numbers you enter and exact conversion factors (for example, 1 lb is exactly 453.59237 g). Results are rounded only for display, with extra decimal places for small unit prices so that different prices never look the same.',
  },
  {
    question: 'Is the cheapest unit price always the best buy?',
    answer:
      'Not necessarily. A large pack only saves money if you use it before it goes off, and quality can differ between products. The unit price tells you which pack gives the most for your money; whether that suits you is your call.',
  },
  {
    question: 'Is my data saved or shared?',
    answer:
      'Everything runs in your browser and nothing you enter is sent anywhere. Your currency, recent calculations, shopping lists, subscriptions and receipt summaries are kept in your browser only, and you can delete them at any time from the Privacy page. We use Google Analytics to count visits; it never receives what you type.',
  },
];
