export interface Device {
  slug: string;
  name: string;
  year: number;
  screen: string;
  port: 'Lightning' | 'USB-C';
  chip: string;
  wirelessCharging: string;
  specsUrl: string;
  repairUrl: string;
  notes: string[];
}

// Every device fact below is linked to its manufacturer's specification page.
export const DEVICES: Device[] = [
  {
    slug: 'iphone-13', name: 'iPhone 13', year: 2021, screen: '6.1-inch OLED', port: 'Lightning',
    chip: 'A15 Bionic', wirelessCharging: 'MagSafe and Qi',
    specsUrl: 'https://support.apple.com/en-us/111872',
    repairUrl: 'https://support.apple.com/en-gb/100402',
    notes: ['Lightning charging connector', 'MagSafe and Qi wireless charging', 'USB-C to Lightning cable included when new'],
  },
  {
    slug: 'iphone-14', name: 'iPhone 14', year: 2022, screen: '6.1-inch OLED', port: 'Lightning',
    chip: 'A15 Bionic', wirelessCharging: 'MagSafe and Qi',
    specsUrl: 'https://support.apple.com/en-us/111850',
    repairUrl: 'https://support.apple.com/repair',
    notes: ['Lightning charging connector', 'MagSafe and Qi wireless charging', 'USB-C to Lightning cable included when new'],
  },
  {
    slug: 'iphone-15', name: 'iPhone 15', year: 2023, screen: '6.1-inch OLED', port: 'USB-C',
    chip: 'A16 Bionic', wirelessCharging: 'MagSafe and Qi',
    specsUrl: 'https://support.apple.com/en-gb/111831',
    repairUrl: 'https://support.apple.com/en-us/104900',
    notes: ['USB-C connector supports charging, DisplayPort and USB 2', 'MagSafe and Qi wireless charging', 'USB-C charge cable included when new'],
  },
];

export const getDevice = (slug: string) => DEVICES.find((device) => device.slug === slug);
