import revisedLogo from './zaya-logo-fast.webp';

export const ZAYA_LOGO_SRC = revisedLogo;

export const isCustomLogoSource = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('data:image')
    || normalized.startsWith('blob:')
    || normalized.startsWith('/')
    || normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || /\.(png|jpe?g|webp|gif|svg|ico)$/.test(normalized);
};
