export type Deal = { id: string; name: string; value: number; stage: string; won?: boolean };

export const DEALS: Deal[] = [
  { id: "deal-acme", name: "Acme Corp", value: 8000, stage: "Negotiation" },
  { id: "deal-globex", name: "Globex", value: 5200, stage: "Proposal" },
  { id: "deal-initech", name: "Initech", value: 4300, stage: "Discovery" },
  { id: "deal-umbrella", name: "Umbrella", value: 2900, stage: "Qualification" },
];

export const CONTACTS = [
  { name: "Ada Lovelace", email: "ada@acme.co", role: "Champion" },
  { name: "Grace Hopper", email: "grace@globex.com", role: "Economic buyer" },
  { name: "Alan Turing", email: "alan@initech.io", role: "End user" },
];

export const PIPELINE_TOTAL = DEALS.reduce((s, d) => s + d.value, 0); // 20,400

export const money = (n: number) => "$" + n.toLocaleString("en-US");
