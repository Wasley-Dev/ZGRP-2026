type Channel = 'SMS' | 'Email' | 'WhatsApp';

export interface DeliveryReceipt {
  providerMessageId: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'UNKNOWN';
  deliveredAt?: string;
  failedReason?: string;
}

export interface DispatchCampaignResponse {
  requestId: string;
  providerMessageIds: string[];
  accepted: number;
  failed: number;
}

interface BackendDispatchResponse {
  requestId?: string;
  results?: Array<{
    providerMessageId?: string;
    status?: string;
    recipient?: string;
    error?: string;
  }>;
  accepted?: number;
  failed?: number;
}

const API_URL = (import.meta.env.VITE_COMM_API_URL as string | undefined)?.trim();
const API_TOKEN = (import.meta.env.VITE_COMM_API_TOKEN as string | undefined)?.trim();
export const EMAIL_SENDER =
  (import.meta.env.VITE_EMAIL_SENDER as string | undefined)?.trim() ||
  'customercare@zayagroupltd.com';
export const SMS_SENDER =
  (import.meta.env.VITE_SMS_SENDER as string | undefined)?.trim() || '+255779630201';
export const hasMessagingBackend = () => Boolean(API_URL);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseStatus = (status?: string): DeliveryReceipt['status'] => {
  const s = (status || '').toUpperCase();
  if (s === 'QUEUED') return 'QUEUED';
  if (s === 'SENT') return 'SENT';
  if (s === 'DELIVERED') return 'DELIVERED';
  if (s === 'FAILED') return 'FAILED';
  return 'UNKNOWN';
};

const sendWithRetry = async <T>(
  input: RequestInfo | URL,
  init: RequestInit,
  retries = 2
): Promise<T> => {
  let lastError: unknown = new Error('Unknown network error');
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok) return (await response.json()) as T;
      if (response.status >= 500) throw new Error(`Server error: ${response.status}`);
      const text = await response.text();
      throw new Error(`Request failed: ${response.status} ${text}`);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await delay(500 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed after retries');
};

const buildHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`;
  return headers;
};

const ensureConfigured = () => {
  if (!API_URL) {
    throw new Error('Messaging backend is not configured. Set VITE_COMM_API_URL.');
  }
};

export const sendEmailCampaign = async (
  recipients: string[],
  body: string
): Promise<DispatchCampaignResponse> => {
  ensureConfigured();
  const payload = {
    channel: 'EMAIL' as Channel,
    from: EMAIL_SENDER,
    to: recipients,
    subject: 'ZAYA GROUP Notification',
    body,
  };

  const response = await sendWithRetry<BackendDispatchResponse>(
    `${API_URL}/v1/messages/email`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    },
    2
  );

  const providerMessageIds =
    response.results
      ?.map((result) => result.providerMessageId)
      .filter((id): id is string => Boolean(id)) || [];

  return {
    requestId: response.requestId || `email-${Date.now()}`,
    providerMessageIds,
    accepted: response.accepted ?? providerMessageIds.length,
    failed: response.failed ?? 0,
  };
};

export const sendSmsCampaign = async (
  recipients: string[],
  body: string
): Promise<DispatchCampaignResponse> => {
  ensureConfigured();
  const payload = {
    channel: 'SMS' as Channel,
    from: SMS_SENDER,
    to: recipients,
    body,
  };

  const response = await sendWithRetry<BackendDispatchResponse>(
    `${API_URL}/v1/messages/sms`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    },
    3
  );

  const providerMessageIds =
    response.results
      ?.map((result) => result.providerMessageId)
      .filter((id): id is string => Boolean(id)) || [];

  return {
    requestId: response.requestId || `sms-${Date.now()}`,
    providerMessageIds,
    accepted: response.accepted ?? providerMessageIds.length,
    failed: response.failed ?? 0,
  };
};

interface BackendStatusResponse {
  receipts?: Array<{
    providerMessageId: string;
    status?: string;
    deliveredAt?: string;
    failedReason?: string;
  }>;
}

export const fetchSmsDeliveryReceipts = async (
  providerMessageIds: string[]
): Promise<DeliveryReceipt[]> => {
  ensureConfigured();
  if (providerMessageIds.length === 0) return [];
  const response = await sendWithRetry<BackendStatusResponse>(
    `${API_URL}/v1/messages/sms/status`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ providerMessageIds }),
    },
    2
  );

  return (
    response.receipts?.map((receipt) => ({
      providerMessageId: receipt.providerMessageId,
      status: parseStatus(receipt.status),
      deliveredAt: receipt.deliveredAt,
      failedReason: receipt.failedReason,
    })) || []
  );
};
