export function extension(path: string) {
  return path.split('.').pop()?.toLowerCase() || '';
}

export function baseName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export function dirName(path: string) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '';
}

export function joinPath(base: string, child: string) {
  const normalizedBase = normalizePath(base);
  const normalizedChild = child.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalizePath(normalizedBase ? `${normalizedBase}/${normalizedChild}` : normalizedChild);
}

export function withoutTexExtension(path: string) {
  return normalizePath(path).replace(/\.(tex|ltx)$/i, '');
}

export function withoutKnownImageExtension(path: string) {
  return normalizePath(path).replace(/\.(pdf|png|jpe?g|gif|webp|svg|bmp|eps)$/i, '');
}
