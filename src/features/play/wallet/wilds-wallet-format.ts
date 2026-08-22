export function formatWildsPhiExact(microPhi: string) {
  const padded = microPhi.padStart(7, "0");
  const whole = padded.slice(0, -6).replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(-6).replace(/0+$/, "");
  return `${whole || "0"}${fraction ? `.${fraction}` : ""}`;
}

export function formatWildsPhiCompact(microPhi: string) {
  const exact = formatWildsPhiExact(microPhi);
  const [whole = "0"] = exact.split(".");
  if (whole.length <= 3) return exact;
  const suffixes = ["", "K", "M", "B", "T", "Q"];
  const tier = Math.min(Math.floor((whole.length - 1) / 3), suffixes.length - 1);
  const headLength = whole.length - tier * 3;
  const decimal = whole.slice(headLength, headLength + 1);
  return `${whole.slice(0, headLength)}${decimal && decimal !== "0" ? `.${decimal}` : ""}${suffixes[tier]}`;
}

export function parseWildsPhiInput(value: string) {
  const normalized = value.trim();
  if (!/^(?:0|[1-9][0-9]{0,23})(?:\.[0-9]{1,6})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const micro = `${whole}${fraction.padEnd(6, "0")}`.replace(/^0+(?=\d)/, "");
  return micro === "0" ? null : micro;
}

export function formatWildsUsdCents(cents: string) {
  const padded = cents.padStart(3, "0");
  const whole = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(-2);
  return `$${(whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
