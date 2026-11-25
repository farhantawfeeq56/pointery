// Demo CRM is dev-only. Production must not show it.
// Enabled when POINTERY_DEMO=1/true, or in any non-production environment
// (so `next dev` just works). Disabled in production builds unless forced on.
export function isDemoEnabled() {
  const flag = process.env.POINTERY_DEMO;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}
