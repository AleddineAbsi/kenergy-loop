// Seed knowledge base for the RAG agent. Concise, factual snippets the LLM
// can ground its action plan in. All sources prefixed with "seed:" so the
// seeder can wipe and reinsert idempotently.
export type SeedChunk = {
  source: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export const SEED_KNOWLEDGE: SeedChunk[] = [
  {
    source: "seed:heating",
    title: "Smart thermostatic radiator valves (TRVs)",
    content:
      "Smart TRVs like tado°, Eve Thermo, AVM FRITZ!DECT 302, and Bosch Smart Home replace mechanical radiator knobs. They schedule per-room heating and detect open windows, typically saving 8-15% on heating energy in apartments with hydronic radiators. Compatible with Matter/Zigbee/DECT depending on brand. Installation is tool-free in most German/EU rentals — landlord permission is usually not required because the original valve is preserved.",
    metadata: { category: "heating", savings_pct: 12 },
  },
  {
    source: "seed:heating",
    title: "Setting back heating temperature",
    content:
      "Lowering indoor temperature by 1°C reduces heating energy use by roughly 6%. Recommended setpoints: 20-21°C in living areas during occupancy, 17-18°C in bedrooms, 16°C as a night/away setback. Smart TRVs automate this. For gas heating at €0.12/kWh and ~10,000 kWh/year, a 1°C reduction saves ~€72/year.",
    metadata: { category: "heating", savings_pct: 6 },
  },
  {
    source: "seed:standby",
    title: "Smart plugs and standby power",
    content:
      "Standby (vampire) loads from TVs, game consoles, AV receivers, desktop PCs, printers, and chargers can account for 5-10% of a household's electricity bill. Smart plugs (TP-Link Tapo P110, Shelly Plug S, AVM FRITZ!DECT 200) measure and schedule cut-off. Group entertainment devices on one plug with a schedule (off 00:00-07:00) for ~€30-60/year savings per cluster.",
    metadata: { category: "standby", savings_eur_per_year: 50 },
  },
  {
    source: "seed:lighting",
    title: "Smart lighting and motion sensors",
    content:
      "LED bulbs already use ~85% less than incandescents, so the savings from smart lighting come from automation: motion sensors in hallways/bathrooms, daylight-based dimming, and away schedules. Philips Hue, IKEA TRÅDFRI, and Aqara are Zigbee-compatible. Expected savings: €15-30/year per always-on lamp converted to motion control.",
    metadata: { category: "lighting", savings_eur_per_year: 25 },
  },
  {
    source: "seed:appliances",
    title: "Refrigerator and washing machine efficiency",
    content:
      "An A-rated fridge uses ~150 kWh/year; an old C/D-rated one can use 350+ kWh/year — replacement saves ~€55/year at €0.28/kWh. Wash laundry at 30°C instead of 60°C to cut cycle energy by ~60%. Run dishwashers and washing machines at full load and during off-peak hours if on a dynamic tariff (Tibber, Octopus Germany, aWATTar).",
    metadata: { category: "appliances" },
  },
  {
    source: "seed:insulation",
    title: "Renter-friendly insulation upgrades",
    content:
      "Renters can deploy reversible measures: radiator reflective panels (€15, ~3% heating saving on external-wall radiators), draft excluders for doors and windows (€10-30), thermal curtains, and self-adhesive window insulation film. None require landlord approval. Larger measures (double-glazing, wall insulation, heat-pump install) require written landlord consent and are landlord-funded in most EU jurisdictions.",
    metadata: { category: "insulation", landlord_required: false },
  },
  {
    source: "seed:hot-water",
    title: "Hot water and showers",
    content:
      "Hot water is typically 12-15% of a household's energy bill. Low-flow shower heads (Hansgrohe EcoSmart, Methven Satinjet) cut water use 40-50% with no comfort loss, saving €60-120/year for a 2-person household. Setting electric boilers to 55-60°C (not 70°C+) avoids excess standby loss.",
    metadata: { category: "hot-water" },
  },
  {
    source: "seed:monitoring",
    title: "Whole-home energy monitoring",
    content:
      "Devices like Shelly EM, Shelly Pro 3EM, IAMMETER, or Tibber Pulse (for German Ferraris/digital meters with optical port) provide real-time consumption data. Knowing your baseline reduces consumption ~5-10% via behavior change alone (Hawthorne effect + spotting anomalies). Most cost €60-150, payback within a year.",
    metadata: { category: "monitoring", savings_pct: 7 },
  },
  {
    source: "seed:hub",
    title: "Smart home hubs and Matter",
    content:
      "Matter (over Thread/Wi-Fi) is the cross-vendor smart home standard. Recommended hubs: Home Assistant Green (€100, open, no cloud lock-in), Apple HomePod mini (€100, Matter controller), Amazon Echo Hub, SmartThings Hub. Choose Zigbee+Matter for the widest device support. Avoid single-vendor ecosystems (e.g. proprietary Tuya-only) for long-term flexibility.",
    metadata: { category: "hub" },
  },
  {
    source: "seed:tariff",
    title: "Dynamic electricity tariffs in EU",
    content:
      "Dynamic/spot-price tariffs (Tibber, aWATTar, Octopus Germany, Barry, Wibee) bill at hourly wholesale price. Combined with smart plugs and EV charging automation, households shift 20-40% of consumption to cheap hours, saving €100-300/year for a 3,500 kWh/year household. Requires a digital/smart meter (mME or iMSys in Germany).",
    metadata: { category: "tariff" },
  },
  {
    source: "seed:co2",
    title: "EU electricity carbon intensity",
    content:
      "Average EU grid intensity is ~0.22 kg CO2 per kWh in 2024, ranging from 0.03 (France, nuclear) to 0.55 (Poland, coal). Germany averages ~0.38 kg/kWh. Use these factors to translate kWh savings into CO2 avoided. Gas heating is ~0.20 kg CO2 per kWh of gas burned.",
    metadata: { category: "co2" },
  },
];
