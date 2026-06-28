export type UsageSummaryItem = {
  type: string;
  quantity: number;
};

export type UsageSummary = {
  periodStart: Date;
  periodEnd: Date;
  items: UsageSummaryItem[];
};
