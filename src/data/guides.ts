export interface GuideStep {
  title: string;
  body: string;
}

export type GuideType = 'Repair & troubleshooting' | 'Buying used' | 'Upgrades & compatibility';

export interface Guide {
  slug: string;
  title: string;
  /** Meta description and card text. */
  short: string;
  type: GuideType;
  published: string;
  updated: string;
  intro: string;
  /** Numbered steps are marked up as a HowTo; explainers use plain sections. */
  format?: 'steps' | 'sections';
  steps: GuideStep[];
  faq: { question: string; answer: string }[];
  sources: { label: string; url: string }[];
  note: string;
  /** Other guides to link to. */
  related: string[];
  /** Device pages and hubs worth linking from this guide. */
  links?: { label: string; href: string }[];
  /** Tool slugs from data/tools.ts. */
  tools?: string[];
}

export const GUIDE_TYPES: { type: GuideType; blurb: string }[] = [
  { type: 'Repair & troubleshooting', blurb: 'Safe checks to run before paying for a repair.' },
  { type: 'Upgrades & compatibility', blurb: 'What fits, what to keep and when to replace.' },
  { type: 'Buying used', blurb: 'Inspect, verify and sell secondhand devices safely.' },
];

export const GUIDES: Guide[] = [
  {
    slug: 'iphone-wont-charge',
    title: 'iPhone won’t charge? Try these checks',
    short: 'Work through Apple’s basic cable, power and port checks before arranging service.',
    type: 'Repair & troubleshooting', published: '2026-10-24', updated: '2026-10-24',
    intro: 'Start with reversible checks. Stop if a cable or adapter is damaged, or if the phone reports liquid in its connector.',
    steps: [
      { title: 'Check the cable and adapter', body: 'Look for breaks, bent pins or other visible damage. Do not use damaged accessories. Try a known-working cable and adapter with the correct connector for your iPhone.' },
      { title: 'Check the power source', body: 'Use a wall outlet and make sure each connection is firm. If needed, try another outlet.' },
      { title: 'Inspect the charging port', body: 'Apple recommends removing debris from the charging port. If the connector may be wet, do not plug a cable into it; follow Apple’s liquid-detection instructions instead.' },
      { title: 'Restart and try again', body: 'Restart the iPhone, then leave it connected to power. If it still will not charge, use Apple’s support steps or arrange a service assessment rather than opening the device.' },
    ],
    faq: [
      { question: 'Which cable does my iPhone need?', answer: 'It depends on the model. iPhone 15 and later use USB-C; earlier models in our library use Lightning. Check the exact model on its device page.' },
      { question: 'Can a dirty charging port stop an iPhone charging?', answer: 'Apple recommends checking the port for debris. Do not push sharp objects into it, and do not plug in a cable if you suspect the connector is wet.' },
    ],
    sources: [
      { label: 'If your iPhone won’t charge — Apple Support', url: 'https://support.apple.com/en-us/108805' },
      { label: 'If you see a liquid-detection alert — Apple Support', url: 'https://support.apple.com/en-us/102643' },
    ],
    note: 'These checks help narrow down common charging problems; they cannot diagnose a failed battery, port or adapter.',
    related: ['iphone-battery-health', 'iphone-overheating', 'iphone-wont-turn-on'],
    links: [{ label: 'Which iPhones use USB-C?', href: '/ports/usb-c/' }, { label: 'Which iPhones use Lightning?', href: '/ports/lightning/' }, { label: 'Cable compatibility finder', href: '/compatibility/' }],
    tools: ['repair-vs-replace'],
  },
  {
    slug: 'buying-a-used-iphone',
    title: 'Used iPhone: a buyer’s checklist',
    short: 'Check ownership lock, parts history, condition and the exact model before paying.',
    type: 'Buying used', published: '2026-10-24', updated: '2026-10-24',
    intro: 'Inspect the phone in person where possible. Do not pay for a device that is still linked to someone else’s account or cannot be erased and set up.',
    steps: [
      { title: 'Confirm it can be set up', body: 'Ask the seller to erase the iPhone and follow setup far enough to confirm it is not protected by Activation Lock. Apple says not to buy a device that shows “iPhone Locked to Owner”.' },
      { title: 'Read the parts history', body: 'On the phone, open Settings → General → About. On supported models and software, inspect Parts and Service History and ask about any “Unknown” or “Used” labels.' },
      { title: 'Test the essentials', body: 'Check the display and touch response, cameras, speakers, microphones, buttons, Wi-Fi, cellular connection and charging with a cable that fits the phone.' },
      { title: 'Check the battery', body: 'Open Settings → Battery → Battery Health. Apple describes maximum capacity and whether the battery is supporting normal peak performance. A battery reporting significant degradation is a reason to negotiate or walk away.' },
      { title: 'Match the model to accessories', body: 'Confirm the exact model name in Settings → General → About before buying a case, screen protector or model-specific part. Similar names do not guarantee a physical fit.' },
      { title: 'Agree on proof and return terms', body: 'Ask for the original receipt if available, record the serial number privately, and get the seller’s return terms in writing.' },
    ],
    faq: [
      { question: 'What is Activation Lock?', answer: 'It ties an iPhone to the Apple Account of its owner. Apple says not to buy a preowned device that shows “iPhone Locked to Owner”, because you will not be able to set it up as your own.' },
      { question: 'How do I check a used iPhone’s battery?', answer: 'Open Settings → Battery → Battery Health. It shows maximum capacity and any performance-management message on supported models.' },
    ],
    sources: [
      { label: 'If you want to buy a preowned iPhone — Apple Support', url: 'https://support.apple.com/en-us/104999' },
      { label: 'iPhone Parts and Service History — Apple Support', url: 'https://support.apple.com/en-us/102658' },
      { label: 'iPhone battery and performance — Apple Support', url: 'https://support.apple.com/en-us/101575' },
    ],
    note: 'A checklist cannot establish a phone’s ownership, repair quality, remaining battery life or future reliability. Verify those directly with the seller and service provider.',
    related: ['how-to-identify-your-iphone-model', 'iphone-battery-health', 'sell-or-trade-in-your-iphone'],
    links: [{ label: 'Browse iPhone models', href: '/devices/' }, { label: 'Compare two iPhones', href: '/compare/' }],
    tools: ['cost-per-use', 'repair-vs-replace'],
  },
  {
    slug: 'iphone-battery-health',
    title: 'iPhone battery health: what it means and when to replace',
    short: 'Understand maximum capacity and peak performance, and know when Apple suggests battery service.',
    type: 'Repair & troubleshooting', published: '2026-10-24', updated: '2026-10-24',
    intro: 'A battery that drains faster is not always a failing battery. Check what iOS reports first, then decide between care, service and replacement.',
    steps: [
      { title: 'Open Battery Health', body: 'Go to Settings → Battery → Battery Health. Apple’s page explains that this screen reports maximum capacity and peak performance capability.' },
      { title: 'Read maximum capacity', body: 'Maximum capacity compares the battery with when it was new. It declines as the battery chemically ages, which shortens the time between charges. A new phone can show slightly under 100%.' },
      { title: 'Know the design target', body: 'Apple designs iPhone 14 models and earlier to retain up to 80% of original capacity at 500 complete charge cycles, and iPhone 15 models at 1,000 cycles, under normal conditions. That 80% is a design target, not an official replacement trigger.' },
      { title: 'Check for performance management', body: 'An aged, cold or low battery can struggle to deliver peak power, which can cause unexpected shutdowns. iOS can then limit peak performance. The Battery Health screen shows when this has been applied.' },
      { title: 'Act on a “significantly degraded” message', body: 'If Battery Health reports that the battery is significantly degraded, Apple says service can restore full performance and capacity. Book an assessment through Apple or an authorised provider.' },
      { title: 'Slow the ageing', body: 'Apple notes that storing an iPhone half charged and avoiding prolonged heat, including direct sun, helps slow chemical ageing.' },
    ],
    faq: [
      { question: 'At what battery health percentage should I replace my iPhone battery?', answer: 'Apple’s page does not set a percentage. It recommends service when Battery Health reports significant degradation. The 80% figure is how much capacity Apple designs batteries to retain after 500 cycles (iPhone 14 and earlier) or 1,000 cycles (iPhone 15).' },
      { question: 'Does heat damage an iPhone battery?', answer: 'Apple says prolonged heat, including direct sunlight, speeds up chemical ageing, and very hot use can permanently shorten battery life.' },
    ],
    sources: [
      { label: 'iPhone battery and performance — Apple Support', url: 'https://support.apple.com/en-us/101575' },
      { label: 'Apple repair options', url: 'https://support.apple.com/repair' },
    ],
    note: 'Battery Health is an estimate reported by iOS. It does not predict exactly when a battery will fail, and it is not shown the same way on every model and software version.',
    related: ['repair-or-replace-your-phone', 'iphone-overheating', 'iphone-wont-charge'],
    links: [{ label: 'Browse iPhone models', href: '/devices/' }],
    tools: ['repair-vs-replace', 'cost-per-use'],
  },
  {
    slug: 'iphone-storage-full',
    title: 'iPhone storage full? Free up space safely',
    short: 'Find what is using space, offload apps without losing data and know what a computer view can’t show.',
    type: 'Repair & troubleshooting', published: '2026-10-24', updated: '2026-10-24',
    intro: 'A full phone feels slow and blocks updates and photos. Check where the space is going before you delete anything.',
    steps: [
      { title: 'Open the storage screen', body: 'Go to Settings → General and open the iPhone Storage entry to see recommendations and a per-app breakdown.' },
      { title: 'Review recommendations', body: 'Tap Show All under Recommendations. You can enable a suggestion, or tap it to see what it would remove before you decide.' },
      { title: 'Look at the largest apps', body: 'Tap an app to see its storage details. Large videos and apps are the usual culprits, and Apple suggests removing large items when you see a low-storage alert.' },
      { title: 'Offload before you delete', body: 'Offloading an app keeps its documents and data. Deleting it removes the app and its related data, so choose carefully.' },
      { title: 'Check from a computer if you need to', body: 'Connect the phone to a Mac (Finder) or a Windows PC (Apple Devices app) and hover over the storage bar. Cached media can appear as “Other” there, so the phone itself gives more accurate Music and Video totals.' },
    ],
    faq: [
      { question: 'What is the difference between offloading and deleting an app?', answer: 'Offloading frees the space used by the app but keeps its documents and data. Deleting removes the app together with its related data.' },
      { question: 'Why does my computer show a large “Other” category?', answer: 'Apple notes that cached music, video and photo files appear as “Other” in the computer view. Check the iPhone’s own storage screen for accurate per-category figures.' },
    ],
    sources: [{ label: 'How to check the storage on your iPhone and iPad — Apple Support', url: 'https://support.apple.com/en-us/108429' }],
    note: 'Content stored in iCloud or synced from a computer is not removed automatically, so the space it uses on the phone is managed separately.',
    related: ['iphone-wont-turn-on', 'sell-or-trade-in-your-iphone', 'repair-or-replace-your-phone'],
    links: [{ label: 'Browse iPhone models', href: '/devices/' }],
  },
  {
    slug: 'iphone-overheating',
    title: 'iPhone getting hot? What is normal and what to do',
    short: 'Apple’s operating range, the temperature warning screen and what to avoid in heat and cold.',
    type: 'Repair & troubleshooting', published: '2026-10-24', updated: '2026-10-24',
    intro: 'A warm iPhone is not always a faulty one, but sustained heat shortens battery life. Cool it down first, then look for the cause.',
    steps: [
      { title: 'Turn it off and move it somewhere cooler', body: 'Out of direct sunlight is best. Apple says the device may slow or stop charging, dim the display, weaken the cellular signal or reduce performance as built-in protection.' },
      { title: 'Respect the temperature warning', body: 'If a temperature warning screen appears, turn the iPhone off and let it cool down. Apple notes an iPhone may still make emergency calls from that screen. “Charging On Hold” means charging resumes once it reaches a normal temperature.' },
      { title: 'Stay inside the operating range', body: 'Apple says to use iPhone where the surrounding air is about 0–35 °C (32–95 °F) and to store it between −20 and 45 °C (−4 to 113 °F).' },
      { title: 'Avoid the usual triggers', body: 'Apple lists leaving the phone in a hot car, long periods in direct sunlight, and extended GPS navigation, graphics-heavy games or camera use in heat.' },
      { title: 'Seek service if it keeps happening', body: 'If the phone overheats in normal conditions after you have removed those triggers, arrange an assessment rather than opening the device yourself.' },
    ],
    faq: [
      { question: 'What temperature is too hot for an iPhone?', answer: 'Apple’s operating range is about 0–35 °C (32–95 °F) ambient. Outside it the phone may change its behaviour, and very hot use can permanently shorten battery life.' },
      { question: 'Can cold weather hurt an iPhone?', answer: 'Apple says very cold use can temporarily shorten battery life, shut the device off or stop charging. Battery life returns to normal when the phone warms up.' },
    ],
    sources: [{ label: 'If your iPhone or iPad gets too hot or too cold — Apple Support', url: 'https://support.apple.com/en-us/HT201678' }],
    note: 'This guide covers environmental heat and normal protections. It cannot diagnose a hardware fault such as a failing battery.',
    related: ['iphone-battery-health', 'iphone-wont-charge', 'repair-or-replace-your-phone'],
    links: [{ label: 'Browse iPhone models', href: '/devices/' }],
  },
  {
    slug: 'iphone-wont-turn-on',
    title: 'iPhone won’t turn on or is frozen: force restart steps',
    short: 'Charge first, then force restart a frozen iPhone using the button sequence for your model.',
    type: 'Repair & troubleshooting', published: '2026-10-24', updated: '2026-10-24',
    intro: 'A black or frozen screen is often fixable without a repair. Work from the least invasive step to the most.',
    steps: [
      { title: 'Charge it', body: 'Charge the iPhone for an hour with a cable and adapter that fit, then try again. If a low-battery icon appears, Apple suggests checking the hardware, then charging for 30 minutes or until the phone starts.' },
      { title: 'Force restart a Face ID model', body: 'Quickly press and release volume up, then quickly press and release volume down. Then hold the side button until the Apple logo appears, which can take more than ten seconds.' },
      { title: 'Force restart a Home button model', body: 'On iPhone 7 and 7 Plus, hold the side and volume down buttons together. On iPhone 6s and earlier, hold the Home button with the side or top button. Check Apple’s page if your model is not listed here.' },
      { title: 'Try a different cable and outlet', body: 'If nothing happens, swap the cable and wall outlet. Inspect the charging port as described in the charging guide.' },
      { title: 'Get service if it still will not start', body: 'Apple recommends service if the iPhone still does not turn on after these steps.' },
    ],
    faq: [
      { question: 'Does a force restart erase my data?', answer: 'No. A force restart does not erase the content on your iPhone; it restarts the phone.' },
      { question: 'How long should I charge a dead iPhone before trying again?', answer: 'Apple’s guidance is to charge for an hour, then try again. If a low-battery icon shows, charge for about 30 minutes or until it starts.' },
    ],
    sources: [{ label: 'Restart an unresponsive iPhone — Apple Support', url: 'https://support.apple.com/en-us/HT201412' }],
    note: 'Button sequences differ by model and can change with new hardware. Use the exact model name from Settings → General → About, or Apple’s page, to confirm yours.',
    related: ['iphone-wont-charge', 'iphone-battery-health', 'how-to-identify-your-iphone-model'],
    links: [{ label: 'Browse iPhone models', href: '/devices/' }],
  },
  {
    slug: 'how-to-identify-your-iphone-model',
    title: 'How to identify your iPhone model',
    short: 'Find the exact model name so cables, cases and parts actually fit.',
    type: 'Upgrades & compatibility', published: '2026-10-24', updated: '2026-10-24',
    intro: 'Accessories, parts and repair advice are model-specific. Confirm the exact name before you order anything.',
    steps: [
      { title: 'Open About', body: 'Go to Settings → General → About. The model name is listed there, for example “iPhone 14 Pro”.' },
      { title: 'Match it to Apple’s list', body: 'Apple publishes a list of iPhone models with links to each model’s technical specifications, so you can check the connector, display size and chip.' },
      { title: 'Check the details on our device page', body: 'Open the matching page in our library to see the charging port, chip, display and wireless charging at a glance, with links back to Apple’s source.' },
      { title: 'Treat similar names with care', body: 'A Pro and a base model of the same generation, or an iPhone with a similar name from another year, can differ in size and parts. Do not assume a case or screen protector fits.' },
    ],
    faq: [
      { question: 'Where do I find my iPhone model name?', answer: 'Settings → General → About shows the model name. Apple’s list of iPhone models links each one to its technical specifications.' },
      { question: 'Do all iPhones use the same cable?', answer: 'No. iPhone 15 and later use USB-C. The earlier models in our library use Lightning.' },
    ],
    sources: [{ label: 'Identify your iPhone model — Apple Support', url: 'https://support.apple.com/en-us/108044' }],
    note: 'Regional variants and carrier models can have different model numbers. Always confirm against Apple’s documentation for your exact device.',
    related: ['lightning-vs-usb-c-iphone', 'buying-a-used-iphone', 'iphone-wont-turn-on'],
    links: [{ label: 'Browse iPhone models', href: '/devices/' }, { label: 'Cable compatibility finder', href: '/compatibility/' }],
  },
  {
    slug: 'lightning-vs-usb-c-iphone',
    title: 'Lightning vs USB-C on iPhone: which models use which',
    short: 'iPhone 15 and later use USB-C; earlier models use Lightning. See what that means for cables and upgrades.',
    type: 'Upgrades & compatibility', published: '2026-10-24', updated: '2026-10-24', format: 'sections',
    intro: 'Apple changed the iPhone charging port with the iPhone 15 series. Knowing which side of the line your phone is on saves you buying the wrong cable.',
    steps: [
      { title: 'Which models use USB-C', body: 'Every iPhone from the iPhone 15 series onwards in our library uses USB-C: the 15 series, 16 series and 17 series, including iPhone Air. Apple’s specifications for each model list the connector.' },
      { title: 'Which models use Lightning', body: 'The iPhone 11, 12, 13 and 14 series, and the 2nd and 3rd generation iPhone SE, use Lightning. These phones need a cable with a Lightning plug at the phone end.' },
      { title: 'What fits what', body: 'A cable fits when its phone-end plug matches the phone’s port. USB-C to USB-C and USB-C to Lightning are different cables, even though both have a USB-C plug at the wall or adapter end.' },
      { title: 'If you are upgrading from Lightning to USB-C', body: 'Your existing Lightning cables will not plug into a USB-C iPhone. Count the cables you use at home, in the car and at work before you decide the upgrade is cheap.' },
      { title: 'What this does not tell you', body: 'The connector match says nothing about charging speed, data features or cable quality. Check the specifications of the exact model and the cable.' },
    ],
    faq: [
      { question: 'Which iPhone was the first to use USB-C?', answer: 'The iPhone 15 series, introduced in 2023, was the first iPhone line with a USB-C port.' },
      { question: 'Does the iPhone 14 use USB-C?', answer: 'No. The iPhone 14 series uses a Lightning port.' },
    ],
    sources: [
      { label: 'iPhone 15 technical specifications — Apple Support', url: 'https://support.apple.com/kb/SP901' },
      { label: 'iPhone 14 technical specifications — Apple Support', url: 'https://support.apple.com/kb/SP873' },
      { label: 'Identify your iPhone model — Apple Support', url: 'https://support.apple.com/en-us/108044' },
    ],
    note: 'Always check the connector listed in Apple’s specifications for your exact model before ordering accessories.',
    related: ['how-to-identify-your-iphone-model', 'iphone-wont-charge', 'repair-or-replace-your-phone'],
    links: [{ label: 'iPhones with USB-C', href: '/ports/usb-c/' }, { label: 'iPhones with Lightning', href: '/ports/lightning/' }, { label: 'Cable compatibility finder', href: '/compatibility/' }],
  },
  {
    slug: 'repair-or-replace-your-phone',
    title: 'Repair or replace your phone? A cost-per-month approach',
    short: 'Compare a repair with a replacement by the cost of each month you expect to use the phone.',
    type: 'Upgrades & compatibility', published: '2026-10-24', updated: '2026-10-24',
    intro: 'The cheapest option today is rarely the cheapest over time. Put both choices on the same scale: money per month of use.',
    steps: [
      { title: 'Get a real repair quote', body: 'Ask for a written price from Apple or an authorised provider for the specific fault. Availability and prices depend on your country and the issue.' },
      { title: 'Estimate how long the phone will last after repair', body: 'Be honest. A new battery can restore performance, but it does not fix a cracked frame or a phone that no longer fits your needs.' },
      { title: 'Price the replacement net of resale', body: 'Take the price of the replacement and subtract what you could sell the old phone for. Our guide on selling or trading in an iPhone lists what to do first.' },
      { title: 'Divide each cost by months of use', body: 'Repair cost divided by months you expect to keep the phone, against replacement cost divided by months you expect to keep the new one. Use the Repair vs Replace tool to do the arithmetic.' },
      { title: 'Include what changes besides price', body: 'A different connector means different cables. A newer model may have a different size, so cases do not carry over. Note those costs on the replacement side.' },
    ],
    faq: [
      { question: 'When is a phone repair worth it?', answer: 'When the repair cost spread over the extra months you expect to use the phone is lower than the monthly cost of a replacement, after resale value is taken off.' },
      { question: 'Do I need to buy new cables with a new iPhone?', answer: 'Only if the port changes. Moving from a Lightning iPhone to an iPhone 15 or later means switching to USB-C cables.' },
    ],
    sources: [
      { label: 'Apple repair options', url: 'https://support.apple.com/repair' },
      { label: 'iPhone battery and performance — Apple Support', url: 'https://support.apple.com/en-us/101575' },
    ],
    note: 'The numbers you enter are estimates. A calculator can compare options; it cannot tell you how long a phone will really last.',
    related: ['iphone-battery-health', 'sell-or-trade-in-your-iphone', 'lightning-vs-usb-c-iphone'],
    links: [{ label: 'Compare two iPhones', href: '/compare/' }, { label: 'Browse iPhone models', href: '/devices/' }],
    tools: ['repair-vs-replace', 'cost-per-use', 'emi-vs-cash'],
  },
  {
    slug: 'sell-or-trade-in-your-iphone',
    title: 'How to prepare your iPhone for sale or trade-in',
    short: 'Back up, check repairs, sign out and erase your iPhone in the order Apple recommends.',
    type: 'Buying used', published: '2026-10-24', updated: '2026-10-24',
    intro: 'Do this in order. Erasing too early can strand your data, and skipping sign-out can leave the next owner locked out.',
    steps: [
      { title: 'Back up and transfer', body: 'Back up the iPhone, then transfer your information to the new device. If your phone number is changing, add extra trusted phone numbers to your account first.' },
      { title: 'Check Parts and Service History', body: 'If any part shows “Finish Repair”, complete that repair before you trade the device in.' },
      { title: 'Unpair and cancel', body: 'Unpair any paired Apple Watch and cancel or transfer any AppleCare plan.' },
      { title: 'Sign out', body: 'Sign out of iCloud and the App Store. If you are switching to a non-Apple phone, deregister iMessage.' },
      { title: 'Erase', body: 'Go to Settings → General → Transfer or Reset → Erase All Content and Settings, enter your passcodes and confirm.' },
      { title: 'Finish up', body: 'If the phone has no SIM card, contact your carrier about transferring service, and remove the device from your trusted devices list.' },
    ],
    faq: [
      { question: 'Should I erase my iPhone before an Apple Store trade-in?', answer: 'Apple’s guidance for Apple Store trade-ins is not to erase it first, because a Specialist handles the remaining steps. Back up and bring your Apple Account password.' },
      { question: 'Why must I sign out before selling?', answer: 'Signing out of iCloud removes the phone from your account. Otherwise the buyer may be unable to set it up, which is why Apple warns buyers off devices that show “iPhone Locked to Owner”.' },
    ],
    sources: [{ label: 'What to do before you sell, give away, or trade in your iPhone or iPad — Apple Support', url: 'https://support.apple.com/en-us/109511' }],
    note: 'Steps vary slightly by iOS version and country. Follow Apple’s page for your software if the screens differ from the ones described here.',
    related: ['buying-a-used-iphone', 'repair-or-replace-your-phone', 'iphone-storage-full'],
    links: [{ label: 'Browse iPhone models', href: '/devices/' }],
    tools: ['repair-vs-replace'],
  },
];

export const getGuide = (slug: string) => GUIDES.find((guide) => guide.slug === slug);
export const guidePath = (slug: string) => `/guides/${slug}/`;
