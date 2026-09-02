// Static shells ship gated regions [hidden]; the auth gate reveals them only
// after the session verdict. Keeps prerendered HTML free of protected UI.
export function revealGate(kind: "required" | "reverse"): void {
  document
    .querySelectorAll(`[data-auth-gate="${kind}"][hidden]`)
    .forEach((el) => el.removeAttribute("hidden"));
}

export function hideGateSpinner(kind: "required" | "reverse"): void {
  document.querySelector(`[data-gate-spinner="${kind}"]`)?.remove();
}
