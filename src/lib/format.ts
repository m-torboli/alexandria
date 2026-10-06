/** "1 articolo", "3 articoli". */
export const plural = (n: number, singular: string, pluralForm: string) =>
  `${n.toLocaleString("it-IT")} ${n === 1 ? singular : pluralForm}`;
