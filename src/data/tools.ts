/**
 * Every tool on the site. Drives the homepage grid, the tools hub, the footer,
 * breadcrumbs, related-tool links and structured data.
 */

export type ToolCategory = 'Compare' | 'Save' | 'Plan';

export type ToolIconName =
  | 'scale'
  | 'boxes'
  | 'gift'
  | 'percent'
  | 'repeat'
  | 'calendar'
  | 'gauge'
  | 'bolt'
  | 'basket'
  | 'receipt';

export interface Tool {
  slug: string;
  name: string;
  /** One line for cards: what it does, in plain words. */
  short: string;
  category: ToolCategory;
  icon: ToolIconName;
  /** <title> */
  title: string;
  /** Meta description. */
  description: string;
  related: string[];
}

export const CATEGORIES: { name: ToolCategory; blurb: string }[] = [
  { name: 'Compare', blurb: 'Find the better buy' },
  { name: 'Save', blurb: 'Know the real cost' },
  { name: 'Plan', blurb: 'Keep spending on track' },
];

export const TOOLS: Tool[] = [
  {
    slug: 'price-comparison',
    name: 'Smart Price Comparison',
    short: 'Find the better buy by price per kg, litre or piece.',
    category: 'Compare',
    icon: 'scale',
    title: 'Price comparison tool: which pack is cheaper? | CheaperPack',
    description:
      'Compare prices by quantity in seconds. Type “2kg for 210, 1.5kg for 189” or scan a price tag, and see the best value per kg, litre or piece.',
    related: ['bulk-buying-calculator', 'bogo-calculator', 'grocery-budget'],
  },
  {
    slug: 'bulk-buying-calculator',
    name: 'Bulk Buying Calculator',
    short: 'Check if the big pack is worth it before it expires.',
    category: 'Compare',
    icon: 'boxes',
    title: 'Bulk buying calculator: is the big pack worth it? | CheaperPack',
    description:
      'Compare a regular pack with a bulk pack: price per unit, savings, break-even quantity and a wastage warning based on how fast you use it.',
    related: ['price-comparison', 'bogo-calculator', 'cost-per-use'],
  },
  {
    slug: 'bogo-calculator',
    name: 'BOGO Deal Calculator',
    short: 'See what buy-one-get-one offers really cost per item.',
    category: 'Compare',
    icon: 'gift',
    title: 'BOGO calculator: buy X get Y free, real price per item | CheaperPack',
    description:
      'Work out buy 1 get 1, buy 2 get 1 and any buy X get Y offer: items received, amount paid, price per item and the real discount.',
    related: ['deal-calculator', 'bulk-buying-calculator', 'price-comparison'],
  },
  {
    slug: 'deal-calculator',
    name: 'Smart Deal Calculator',
    short: 'Compare discounts, coupons, cashback and delivery.',
    category: 'Save',
    icon: 'percent',
    title: 'Deal calculator: compare discounts, cashback and delivery | CheaperPack',
    description:
      'Compare offers with percentage or flat discounts, coupons, capped cashback, delivery and buy X get Y. See what you pay at checkout and the effective cost.',
    related: ['bogo-calculator', 'emi-vs-cash', 'price-comparison'],
  },
  {
    slug: 'subscription-calculator',
    name: 'Subscription Savings Calculator',
    short: 'Add up subscriptions and see what you could cut.',
    category: 'Save',
    icon: 'repeat',
    title: 'Subscription calculator: monthly and yearly spending | CheaperPack',
    description:
      'List your subscriptions to see what they cost per month and per year, which cost the most, what cancelling would save and whether annual plans pay off.',
    related: ['cost-per-use', 'grocery-budget', 'electricity-cost'],
  },
  {
    slug: 'emi-vs-cash',
    name: 'EMI vs Cash Calculator',
    short: 'See the true cost of paying in instalments.',
    category: 'Save',
    icon: 'calendar',
    title: 'EMI vs cash calculator: what instalments really cost | CheaperPack',
    description:
      'Compare paying upfront with EMI: monthly instalment, interest, processing fees and the extra cost, including what “no-cost EMI” offers really cost.',
    related: ['deal-calculator', 'cost-per-use', 'subscription-calculator'],
  },
  {
    slug: 'cost-per-use',
    name: 'Cost Per Use Calculator',
    short: 'Find what you really pay each time you use something.',
    category: 'Save',
    icon: 'gauge',
    title: 'Cost per use calculator: is it worth the price? | CheaperPack',
    description:
      'Divide the real cost of owning something by how often you will use it, including upkeep and resale value, and compare two or more options.',
    related: ['emi-vs-cash', 'bulk-buying-calculator', 'subscription-calculator'],
  },
  {
    slug: 'electricity-cost',
    name: 'Electricity Cost Calculator',
    short: 'Estimate what your appliances cost to run.',
    category: 'Save',
    icon: 'bolt',
    title: 'Electricity cost calculator for appliances | CheaperPack',
    description:
      'Estimate daily, monthly and yearly electricity use and cost for each appliance from its wattage, hours of use and your rate per kWh, including standby power.',
    related: ['subscription-calculator', 'cost-per-use', 'grocery-budget'],
  },
  {
    slug: 'grocery-budget',
    name: 'Grocery Budget Planner',
    short: 'Plan a shopping list and stay within budget.',
    category: 'Plan',
    icon: 'basket',
    title: 'Grocery budget planner and shopping list | CheaperPack',
    description:
      'Set a budget, add items as you shop and see the total and what’s left. Tick items off, save lists on your device and reuse them next time.',
    related: ['price-comparison', 'receipt-analyzer', 'bulk-buying-calculator'],
  },
  {
    slug: 'receipt-analyzer',
    name: 'Receipt Expense Analyzer',
    short: 'Scan receipts and see where your money goes.',
    category: 'Plan',
    icon: 'receipt',
    title: 'Receipt scanner and expense analyzer (private, on-device) | CheaperPack',
    description:
      'Photograph a receipt, check the items it reads, sort them into categories and track spending across receipts. Everything stays on your device.',
    related: ['grocery-budget', 'price-comparison', 'subscription-calculator'],
  },
];

export const toolPath = (slug: string) => `/tools/${slug}/`;

export function getTool(slug: string): Tool {
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return tool;
}
