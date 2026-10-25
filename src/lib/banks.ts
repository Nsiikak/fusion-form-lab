/** Nigerian banks supported for payouts and refunds (Paystack bank codes). */
export interface Bank { code: string; name: string; group: string }

export const NIGERIAN_BANKS: Bank[] = [
  { code: "044", name: "Access Bank", group: "Commercial Banks" },
  { code: "063", name: "Access Bank (Diamond)", group: "Commercial Banks" },
  { code: "035A", name: "ALAT by Wema", group: "Commercial Banks" },
  { code: "050", name: "Ecobank Nigeria", group: "Commercial Banks" },
  { code: "070", name: "Fidelity Bank", group: "Commercial Banks" },
  { code: "011", name: "First Bank of Nigeria", group: "Commercial Banks" },
  { code: "214", name: "First City Monument Bank", group: "Commercial Banks" },
  { code: "058", name: "Guaranty Trust Bank", group: "Commercial Banks" },
  { code: "030", name: "Heritage Bank", group: "Commercial Banks" },
  { code: "301", name: "Jaiz Bank", group: "Commercial Banks" },
  { code: "082", name: "Keystone Bank", group: "Commercial Banks" },
  { code: "076", name: "Polaris Bank", group: "Commercial Banks" },
  { code: "101", name: "Providus Bank", group: "Commercial Banks" },
  { code: "221", name: "Stanbic IBTC Bank", group: "Commercial Banks" },
  { code: "068", name: "Standard Chartered Bank", group: "Commercial Banks" },
  { code: "232", name: "Sterling Bank", group: "Commercial Banks" },
  { code: "100", name: "SunTrust Bank", group: "Commercial Banks" },
  { code: "032", name: "Union Bank of Nigeria", group: "Commercial Banks" },
  { code: "033", name: "United Bank for Africa", group: "Commercial Banks" },
  { code: "215", name: "Unity Bank", group: "Commercial Banks" },
  { code: "035", name: "Wema Bank", group: "Commercial Banks" },
  { code: "057", name: "Zenith Bank", group: "Commercial Banks" },
  { code: "100004", name: "Kuda Bank", group: "Digital Banks & Fintechs" },
  { code: "999992", name: "OPay", group: "Digital Banks & Fintechs" },
  { code: "999991", name: "PalmPay", group: "Digital Banks & Fintechs" },
  { code: "090110", name: "VFD Microfinance Bank", group: "Digital Banks & Fintechs" },
  { code: "090267", name: "Moniepoint MFB", group: "Digital Banks & Fintechs" },
  { code: "565", name: "Carbon", group: "Digital Banks & Fintechs" },
];

export const bankName = (code?: string | null) => NIGERIAN_BANKS.find((b) => b.code === code)?.name ?? "";
