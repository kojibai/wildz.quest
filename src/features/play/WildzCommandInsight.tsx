import type { ReactNode } from "react";

export function WildzCommandInsight({
  label,
  value,
  detail,
  children
}: {
  label: string;
  value: string;
  detail: string;
  children?: ReactNode;
}) {
  return <section className="wilds-command-insight" aria-label={label}>
    <span><small>{label}</small><strong>{value}</strong></span>
    <p>{detail}</p>
    {children ? <div className="wilds-command-insight-actions">{children}</div> : null}
  </section>;
}
