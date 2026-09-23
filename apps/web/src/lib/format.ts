// Locale-driven formatting; never hardcode separators or date patterns.
const locale = () => (typeof navigator === 'undefined' ? 'en' : navigator.language);

export const money = (paisa: number) =>
  new Intl.NumberFormat(locale(), { style: 'currency', currency: 'BDT' }).format(paisa / 100);

export const when = (iso: string) =>
  new Intl.DateTimeFormat(locale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(iso));

export const km = (metres: number) =>
  new Intl.NumberFormat(locale(), { style: 'unit', unit: 'kilometer', maximumFractionDigits: 2 }).format(
    metres / 1000,
  );
