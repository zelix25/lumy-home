/**
 * Chemin « logique » de l’app (ex. `/login`) même lorsque l’UI est servie sous un préfixe
 * (tunnel my-lumy : `window.__LUMY_TUNNEL_BASENAME__`).
 */
export function getAppPathname(): string {
  const full = window.location.pathname;
  const base = typeof window !== "undefined" ? window.__LUMY_TUNNEL_BASENAME__ : undefined;
  if (base && base !== "/" && full.startsWith(base)) {
    const rest = full.slice(base.length);
    if (!rest || rest === "") return "/";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return full;
}

export function getTunnelLoginHref(): string {
  const base = typeof window !== "undefined" ? window.__LUMY_TUNNEL_BASENAME__ ?? "" : "";
  return `${base}/login`;
}
