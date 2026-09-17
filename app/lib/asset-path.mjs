export function withBasePath(path, base = '/') {
  const cleanBase = base === '/' ? '' : `/${base.replace(/^\/+|\/+$/g, '')}`;
  const cleanPath = `/${path.replace(/^\/+/, '')}`;
  return `${cleanBase}${cleanPath}`;
}
