// lib/units.ts
// Unit conversion utilities. Always store in metric internally; convert for display.

export type UnitSystem = 'metric' | 'imperial';
export type DateFormat  = 'DMY' | 'MDY' | 'YMD';

// ── Weight ─────────────────────────────────────────────────────────────────

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.20462 * 10) / 10;
}

export function formatWeight(kg: number, system: UnitSystem): string {
  if (system === 'imperial') return `${kgToLbs(kg)} lbs`;
  return `${kg} kg`;
}

export function weightLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'lbs' : 'kg';
}

export function parseWeightToKg(value: number, system: UnitSystem): number {
  return system === 'imperial' ? lbsToKg(value) : value;
}

// ── Length ─────────────────────────────────────────────────────────────────

export function cmToInches(cm: number): number {
  return Math.round(cm / 2.54 * 10) / 10;
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

export function formatLength(cm: number, system: UnitSystem): string {
  if (system === 'imperial') return `${cmToInches(cm)}"`;
  return `${cm} cm`;
}

export function lengthLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'in' : 'cm';
}

// ── Temperature ────────────────────────────────────────────────────────────

export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9 / 5 + 32) * 10) / 10;
}

export function fahrenheitToCelsius(f: number): number {
  return Math.round((f - 32) * 5 / 9 * 10) / 10;
}

export function formatTemperature(celsius: number, system: UnitSystem): string {
  if (system === 'imperial') return `${celsiusToFahrenheit(celsius)}°F`;
  return `${celsius}°C`;
}

export function temperatureLabel(system: UnitSystem): string {
  return system === 'imperial' ? '°F' : '°C';
}

// ── Date Formatting ────────────────────────────────────────────────────────

export function formatDate(date: Date | string, fmt: DateFormat): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  if (fmt === 'DMY') return `${dd}/${mm}/${yyyy}`;
  if (fmt === 'MDY') return `${mm}/${dd}/${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateShort(date: Date | string, fmt: DateFormat): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const yy  = String(d.getFullYear()).slice(-2);
  if (fmt === 'MDY') return `${mm}/${dd}/${yy}`;
  if (fmt === 'YMD') return `${d.getFullYear()}-${mm}-${dd}`;
  return `${dd}/${mm}/${yy}`;
}

export function formatDateTime(date: Date | string, fmt: DateFormat): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${formatDateShort(d, fmt)} ${time}`;
}

// ── Currency ───────────────────────────────────────────────────────────────

export interface CurrencyInfo {
  code:   string;
  symbol: string;
  name:   string;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$',  name: 'US Dollar'         },
  GBP: { code: 'GBP', symbol: '£',  name: 'British Pound'     },
  EUR: { code: 'EUR', symbol: '€',  name: 'Euro'              },
  PKR: { code: 'PKR', symbol: '₨',  name: 'Pakistani Rupee'   },
  INR: { code: 'INR', symbol: '₹',  name: 'Indian Rupee'      },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real'    },
  NGN: { code: 'NGN', symbol: '₦',  name: 'Nigerian Naira'    },
  TRY: { code: 'TRY', symbol: '₺',  name: 'Turkish Lira'      },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  EGP: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound'    },
  SAR: { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal'      },
  KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling'  },
  ZAR: { code: 'ZAR', symbol: 'R',  name: 'South African Rand'},
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar'   },
  MXN: { code: 'MXN', symbol: '$',  name: 'Mexican Peso'      },
  BDT: { code: 'BDT', symbol: '৳',  name: 'Bangladeshi Taka'  },
  PHP: { code: 'PHP', symbol: '₱',  name: 'Philippine Peso'   },
};

// Map country codes to default currency
export const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD', DE: 'EUR', FR: 'EUR',
  IT: 'EUR', ES: 'EUR', NL: 'EUR', PK: 'PKR', IN: 'INR', BR: 'BRL',
  NG: 'NGN', TR: 'TRY', ID: 'IDR', EG: 'EGP', SA: 'SAR', AE: 'SAR',
  KE: 'KES', TZ: 'KES', UG: 'KES', ZA: 'ZAR', MX: 'MXN', BD: 'BDT',
  PH: 'PHP',
};

export function formatCurrency(amount: number, currencyCode: string): string {
  const c = CURRENCIES[currencyCode];
  if (!c) return `${amount}`;
  return `${c.symbol}${amount.toLocaleString()}`;
}

// Premium pricing in different currencies (monthly / annually)
export const PREMIUM_PRICING: Record<string, { monthly: number; annual: number }> = {
  USD: { monthly: 4.99,  annual: 39.99  },
  GBP: { monthly: 3.99,  annual: 31.99  },
  EUR: { monthly: 4.49,  annual: 35.99  },
  PKR: { monthly: 1399,  annual: 11999  },
  INR: { monthly: 399,   annual: 3199   },
  BRL: { monthly: 24.90, annual: 199.90 },
  NGN: { monthly: 3999,  annual: 31999  },
  TRY: { monthly: 129,   annual: 999    },
  IDR: { monthly: 79000, annual: 629000 },
  AUD: { monthly: 7.49,  annual: 59.99  },
  CAD: { monthly: 6.49,  annual: 51.99  },
};
