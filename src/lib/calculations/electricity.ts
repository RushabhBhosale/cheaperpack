/**
 * Appliance running costs from wattage, hours of use and the rate per kWh,
 * including standby power while plugged in but not in use.
 */

import { roundMoney } from './money';

/** A month is treated as 30 days for standby time. */
export const MONTH_DAYS = 30;

export interface Appliance {
  name?: string;
  watts: number;
  hoursPerDay: number;
  daysPerMonth: number;
  standbyWatts: number;
  quantity: number;
}

export interface ApplianceUse {
  /** kWh on a day it's used (including standby the rest of that day). */
  kwhPerUseDay: number;
  kwhPerMonth: number;
  kwhPerYear: number;
  costPerMonth: number;
  costPerYear: number;
  standbyKwhPerMonth: number;
}

export function applianceUse(a: Appliance, ratePerKwh: number): ApplianceUse {
  const q = a.quantity;
  const activeMonth = (a.watts * a.hoursPerDay * a.daysPerMonth) / 1000;
  const standbyHours = Math.max(0, 24 * MONTH_DAYS - a.hoursPerDay * a.daysPerMonth);
  const standbyMonth = (a.standbyWatts * standbyHours) / 1000;
  const kwhPerMonth = (activeMonth + standbyMonth) * q;
  return {
    kwhPerUseDay: ((a.watts * a.hoursPerDay + a.standbyWatts * (24 - a.hoursPerDay)) / 1000) * q,
    kwhPerMonth,
    kwhPerYear: kwhPerMonth * 12,
    costPerMonth: roundMoney(kwhPerMonth * ratePerKwh),
    costPerYear: roundMoney(kwhPerMonth * 12 * ratePerKwh),
    standbyKwhPerMonth: standbyMonth * q,
  };
}

export function electricityTotals(appliances: Appliance[], ratePerKwh: number) {
  const rows = appliances.map((a) => applianceUse(a, ratePerKwh));
  const kwhPerMonth = rows.reduce((t, r) => t + r.kwhPerMonth, 0);
  return {
    rows,
    kwhPerDay: kwhPerMonth / MONTH_DAYS,
    kwhPerMonth,
    kwhPerYear: kwhPerMonth * 12,
    costPerMonth: roundMoney(kwhPerMonth * ratePerKwh),
    costPerYear: roundMoney(kwhPerMonth * 12 * ratePerKwh),
    shares: rows.map((r) => (kwhPerMonth > 0 ? r.kwhPerMonth / kwhPerMonth : 0)),
  };
}

/** Typical wattages, as quick starting points the shopper can edit. */
export const APPLIANCE_PRESETS: { name: string; watts: number; hours: number; standby: number }[] = [
  { name: 'Air conditioner (1.5 ton)', watts: 1500, hours: 8, standby: 2 },
  { name: 'Refrigerator', watts: 150, hours: 24, standby: 0 },
  { name: 'Ceiling fan', watts: 75, hours: 10, standby: 0 },
  { name: 'LED bulb', watts: 9, hours: 6, standby: 0 },
  { name: 'Television', watts: 100, hours: 4, standby: 1 },
  { name: 'Washing machine', watts: 500, hours: 1, standby: 1 },
  { name: 'Water heater', watts: 2000, hours: 1, standby: 0 },
  { name: 'Laptop', watts: 60, hours: 6, standby: 1 },
];
