export type ActionCategory = "do-now" | "small-helper" | "add-info" | "needs-landlord" | "monitor";

export const categoryMeta: Record<ActionCategory, { label: string; tone: string }> = {
  "do-now": { label: "Do Now", tone: "bg-primary/10 text-primary border-primary/20" },
  "small-helper": { label: "Small Helper", tone: "bg-accent/15 text-accent-foreground border-accent/30" },
  "add-info": { label: "Add More Info", tone: "bg-muted text-muted-foreground border-border" },
  "needs-landlord": { label: "Needs Landlord", tone: "bg-destructive/10 text-destructive border-destructive/20" },
  monitor: { label: "Monitor", tone: "bg-secondary text-secondary-foreground border-border" },
};

export const mockScan = {
  score: 64,
  grade: "C",
  rating: "Average — a few easy wins available",
  highlights: [
    { label: "Old incandescent bulb detected", impact: "High", icon: "lightbulb" },
    { label: "Single-pane window, north-facing", impact: "Medium", icon: "wind" },
    { label: "Electric space heater visible", impact: "High", icon: "flame" },
    { label: "Always-on TV standby", impact: "Low", icon: "tv" },
  ],
  estKwhPerMonth: 280,
  estCostPerMonth: 92,
};

export const mockRecommendations: Array<{
  id: string;
  title: string;
  description: string;
  savings: string;
  confidence: number;
  category: ActionCategory;
  why: string;
}> = [
  {
    id: "led",
    title: "Swap 4 bulbs for LEDs",
    description: "Replace remaining incandescent and halogen bulbs with 8W LEDs.",
    savings: "~€38/yr",
    confidence: 92,
    category: "do-now",
    why: "Your scan detected at least one incandescent bulb; LEDs use ~85% less energy for the same brightness.",
  },
  {
    id: "standby",
    title: "Add a smart power strip",
    description: "Cut TV, console and charger standby drain with a master switch.",
    savings: "~€22/yr",
    confidence: 78,
    category: "small-helper",
    why: "Average German household loses ~8% of electricity to standby loads.",
  },
  {
    id: "window",
    title: "Add thermal curtains",
    description: "Heavy curtains reduce heat loss through single-pane windows by up to 25%.",
    savings: "~€60/yr",
    confidence: 71,
    category: "small-helper",
    why: "Scan flagged a single-pane window; renters can install curtains without landlord approval.",
  },
  {
    id: "bill",
    title: "Upload your last electricity bill",
    description: "Improves accuracy of your savings estimate from 'fair' to 'high'.",
    savings: "Better data",
    confidence: 100,
    category: "add-info",
    why: "Your profile is currently based on room scan only.",
  },
  {
    id: "heater",
    title: "Ask landlord about radiator service",
    description: "An unbled radiator can waste 15% of heating energy.",
    savings: "~€110/yr",
    confidence: 64,
    category: "needs-landlord",
    why: "Heating dominates German rental energy bills.",
  },
  {
    id: "track",
    title: "Take weekly meter readings",
    description: "Catches anomalies and unlocks trend alerts.",
    savings: "Insight",
    confidence: 100,
    category: "monitor",
    why: "Manual readings replace the need for a smart meter.",
  },
];

export const mockReadings = [
  { week: "W1", kwh: 72 },
  { week: "W2", kwh: 68 },
  { week: "W3", kwh: 81 },
  { week: "W4", kwh: 64 },
  { week: "W5", kwh: 59 },
  { week: "W6", kwh: 55 },
  { week: "W7", kwh: 52 },
  { week: "W8", kwh: 49 },
];

export const mockAlerts = [
  { id: 1, level: "info", text: "Consumption down 14% vs. last month — nice work." },
  { id: 2, level: "warn", text: "Standby spike detected Tuesday 02:00–05:00." },
];
