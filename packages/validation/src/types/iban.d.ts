declare module 'iban' {
  function isValid(iban: string): boolean;
  function electronicFormat(iban: string): string;
  function printFormat(iban: string, separator?: string): string;

  export { isValid, electronicFormat, printFormat };
}
