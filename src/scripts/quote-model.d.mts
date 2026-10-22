export interface QuoteItem {
  label: string;
  need: string;
  source: 'explorador' | 'casa';
}
export interface QuoteState {
  property: string;
  context: string;
  area: string;
  floors: string;
  needs: string[];
  items: QuoteItem[];
  location: string;
  timing: string;
  message: string;
}
export const NEEDS: readonly string[];
export const TIMINGS: readonly string[];
export const MAX_ITEMS: number;
export const MAX_MESSAGE_CHARS: number;
export const MAX_WHATSAPP_URL_CHARS: number;
export function createEmptyQuote(): QuoteState;
export function sanitizeQuoteState(raw: unknown): QuoteState;
export function validateProjectAddition(
  raw: unknown,
): { need: string; source: 'explorador' | 'casa'; items: string[] } | null;
export function mergeProjectAddition(
  state: unknown,
  raw: unknown,
): { state: QuoteState; added: number; limited: boolean; valid: boolean };
export function getQuoteRecommendations(state: unknown): string[];
export function buildQuoteBrief(state: unknown): string;
export function buildWhatsAppHandoff(
  state: unknown,
  base?: string,
): { message: string; url: string; ready: boolean };
export function serializeQuoteDraft(state: unknown): string;
export function parseQuoteDraft(raw: unknown): QuoteState | null;
