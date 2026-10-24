export interface GuideStep {
  title: string;
  body: string;
}

export interface Guide {
  slug: string;
  title: string;
  short: string;
  type: 'Repair & troubleshooting' | 'Buying used';
  updated: string;
  intro: string;
  steps: GuideStep[];
  sources: { label: string; url: string }[];
  note: string;
}

export const GUIDES: Guide[] = [
  {
    slug: 'iphone-wont-charge',
    title: 'iPhone won’t charge? Try these checks',
    short: 'Work through Apple’s basic cable, power and port checks before arranging service.',
    type: 'Repair & troubleshooting', updated: '2026-10-24',
    intro: 'Start with reversible checks. Stop if a cable or adapter is damaged, or if the phone reports liquid in its connector.',
    steps: [
      { title: 'Check the cable and adapter', body: 'Look for breaks, bent pins or other visible damage. Do not use damaged accessories. Try a known-working cable and adapter with the correct connector for your iPhone.' },
      { title: 'Check the power source', body: 'Use a wall outlet and make sure each connection is firm. If needed, try another outlet.' },
      { title: 'Inspect the charging port', body: 'Apple recommends removing debris from the charging port. If the connector may be wet, do not plug a cable into it; follow Apple’s liquid-detection instructions instead.' },
      { title: 'Restart and try again', body: 'Restart the iPhone, then leave it connected to power. If it still will not charge, use Apple’s support steps or arrange a service assessment rather than opening the device.' },
    ],
    sources: [
      { label: 'If your iPhone won’t charge — Apple Support', url: 'https://support.apple.com/en-us/108805' },
      { label: 'If you see a liquid-detection alert — Apple Support', url: 'https://support.apple.com/en-us/102643' },
    ],
    note: 'These checks help narrow down common charging problems; they cannot diagnose a failed battery, port or adapter.',
  },
  {
    slug: 'buying-a-used-iphone',
    title: 'Used iPhone: a buyer’s checklist',
    short: 'Check ownership lock, parts history, condition and the exact model before paying.',
    type: 'Buying used', updated: '2026-10-24',
    intro: 'Inspect the phone in person where possible. Do not pay for a device that is still linked to someone else’s account or cannot be erased and set up.',
    steps: [
      { title: 'Confirm it can be set up', body: 'Ask the seller to erase the iPhone and follow setup far enough to confirm it is not protected by Activation Lock. Apple says not to buy a device that shows “iPhone Locked to Owner”.' },
      { title: 'Read the parts history', body: 'On the phone, open Settings → General → About. On supported models and software, inspect Parts and Service History and ask about any “Unknown” or “Used” labels.' },
      { title: 'Test the essentials', body: 'Check the display and touch response, cameras, speakers, microphones, buttons, Wi-Fi, cellular connection and charging with a cable that fits the phone.' },
      { title: 'Match the model to accessories', body: 'Confirm the exact model name in Settings → General → About before buying a case, screen protector or model-specific part. Similar names do not guarantee a physical fit.' },
      { title: 'Agree on proof and return terms', body: 'Ask for the original receipt if available, record the serial number privately, and get the seller’s return terms in writing.' },
    ],
    sources: [
      { label: 'If you want to buy a preowned iPhone — Apple Support', url: 'https://support.apple.com/en-us/104999' },
      { label: 'iPhone Parts and Service History — Apple Support', url: 'https://support.apple.com/en-us/102658' },
    ],
    note: 'A checklist cannot establish a phone’s ownership, repair quality, remaining battery life or future reliability. Verify those directly with the seller and service provider.',
  },
];

export const getGuide = (slug: string) => GUIDES.find((guide) => guide.slug === slug);
