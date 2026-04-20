const SAFE_FILENAME_FALLBACK = 'download';

const sanitizeFilename = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
};

const parseContentDispositionFilename = (contentDisposition) => {
  if (!contentDisposition || typeof contentDisposition !== 'string') return null;

  // RFC 5987 format: filename*=UTF-8''encoded_name.pdf
  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return sanitizeFilename(decodeURIComponent(utf8Match[1]));
    } catch {
      return sanitizeFilename(utf8Match[1]);
    }
  }

  // Basic format: filename="name.pdf" OR filename=name.pdf
  const basicMatch = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (basicMatch?.[1]) {
    return sanitizeFilename(basicMatch[1]);
  }

  return null;
};

const triggerBrowserDownload = (blob, filename) => {
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);
};

// IMPORTANT: use this helper (not window.open/href to backend URLs) for protected downloads
// so requests go through the authenticated axios client/interceptors and include auth headers.
export const downloadWithApiAuth = async (api, path, fallbackFilename = SAFE_FILENAME_FALLBACK) => {
  const response = await api.get(path, {
    responseType: 'blob'
  });

  const responseHeaders = response?.headers || {};
  const contentDisposition = responseHeaders['content-disposition'];
  const resolvedFilename = parseContentDispositionFilename(contentDisposition)
    || sanitizeFilename(fallbackFilename)
    || SAFE_FILENAME_FALLBACK;

  triggerBrowserDownload(response.data, resolvedFilename);
  return resolvedFilename;
};
