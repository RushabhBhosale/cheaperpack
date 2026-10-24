/** Raw record from the CPSC Recall Retrieval Web Services (only the fields we use). */
export interface CpscRecall {
  RecallID: number;
  RecallNumber: string;
  RecallDate: string;
  LastPublishDate: string;
  Title: string;
  Description: string | null;
  URL: string;
  ConsumerContact: string | null;
  Products: { Name?: string; Description?: string; Model?: string; Type?: string; NumberOfUnits?: string }[];
  Images: { URL: string; Caption?: string }[];
  Injuries: { Name?: string }[];
  Manufacturers: { Name?: string }[];
  Retailers: { Name?: string }[];
  Importers?: { Name?: string }[];
  Distributors?: { Name?: string }[];
  ManufacturerCountries: { Country?: string }[];
  Hazards: { Name?: string }[];
  Remedies: { Name?: string }[];
  RemedyOptions: { Option?: string }[];
}

export interface ProductInfo {
  name: string;
  description: string;
  model: string;
  units: string;
}

export interface ImageInfo {
  url: string;
  caption: string;
}

/** A recall as stored in D1 and rendered on the site. */
export interface Recall {
  id: number;
  number: string;
  date: string;
  last_publish: string;
  title: string;
  short_title: string;
  slug: string;
  description: string;
  url: string;
  contact: string;
  brand: string;
  brand_slug: string;
  category: string;
  hazards: string[];
  hazard_clause: string;
  remedy: string;
  remedy_options: string[];
  units: string;
  sold_at: string;
  firms: string[];
  countries: string[];
  injuries: string;
  products: ProductInfo[];
  images: ImageInfo[];
  quality: number;
  eligible: boolean;
  idx_rank: number | null;
}

export interface Env {
  DB: D1Database;
  SITE_NAME: string;
  SITE_URL: string;
  /** ISO date the site went live; drives the gradual indexing schedule. */
  LAUNCH_DATE: string;
  CONTACT_EMAIL: string;
  /** e.g. `ca-pub-1234567890123456`. Leave empty until AdSense approves the site. */
  ADSENSE_PUB_ID: string;
  /** Optional manual ad unit slot id. Leave empty to use Auto ads only. */
  ADSENSE_SLOT: string;
  GA_ID: string;
  GSC_VERIFICATION: string;
  INDEXNOW_KEY: string;
  /** Set by the deploy script so each deploy starts with a fresh page cache. */
  CACHE_VERSION?: string;
}
