export type Link = { url: string; text: string };
export type CaptureInput = {
  url: string;
  ignoreSelectors?: string[];
  timeoutMs?: number;
  viewport?: { width: number; height: number };
  signal?: AbortSignal;
};
export type CaptureResult = {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  title: string;
  text: string;
  links: Link[];
  headings: string[];
  imageUrls: string[];
  html: string;
  screenshot: Buffer;
  warnings: string[];
  capturedAt: string;
};
export type DiscoveryInput = {
  url: string;
  candidateUrls?: string[];
  includeSubdomains?: boolean;
  maxPages?: number;
  signal?: AbortSignal;
};
export type DiscoveryResult = {
  urls: { url: string; source: 'sitemap' | 'link' | 'seed' }[];
  warnings: string[];
};
