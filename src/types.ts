export type Link = { url: string; text: string };
export type Rectangle = { x: number; y: number; width: number; height: number };
export type MonitoringRule = { selector: string; label: string };
export type PageContent = { title: string; text: string; headings: string[]; links: Link[]; imageUrls: string[] };
export type CaptureQuality = { status: 'complete' | 'partial'; missingImages: number; reasons: string[] };
export type DetectionData = {
  rulesKey: string; content: PageContent; ignored: Rectangle[];
  important: { selector: string; count: number; text: string; links: Link[]; imageUrls: string[]; rectangles: Rectangle[] }[];
};
export type CaptureInput = {
  url: string;
  ignoreSelectors?: string[];
  importantSelectors?: string[];
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
  quality?: CaptureQuality;
  detection?: DetectionData;
};
export type DiscoveryInput = {
  url: string;
  candidateUrls?: string[];
  includeSubdomains?: boolean;
  maxPages?: number;
  includePaths?: string[];
  excludePaths?: string[];
  signal?: AbortSignal;
};
export type DiscoveryResult = {
  urls: { url: string; source: 'sitemap' | 'link' | 'seed' }[];
  warnings: string[];
  sitemap?: { urls: string[]; sources: string[]; complete: boolean };
};
