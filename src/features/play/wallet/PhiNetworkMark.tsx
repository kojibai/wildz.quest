export function PhiNetworkMark({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`phi-network-mark ${className}`.trim()} />;
}

export function PhiNetworkAmount({ className = "", value }: { className?: string; value: string }) {
  return <span aria-label={`${value} Phi`} className={`phi-network-amount ${className}`.trim()}>
    <PhiNetworkMark />
    <span aria-hidden="true">{value}</span>
  </span>;
}
