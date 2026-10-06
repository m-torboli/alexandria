/** "1 articolo", "3 articoli". */
export const plural = (n: number, singular: string, pluralForm: string) =>
  `${n.toLocaleString("it-IT")} ${n === 1 ? singular : pluralForm}`;

const dateFormat = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

/** "6 ottobre 2026". */
export const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
};

/** "840 KB", "2,4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value < 10 ? 1 : 0;
  return `${value.toLocaleString("it-IT", { maximumFractionDigits: digits })} ${units[unit]}`;
}
