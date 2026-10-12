export function assertRedirectErrorSupported(url: string): void {
  if (typeof Request === "undefined") {
    throw new Error("This runtime does not support redirect blocking.");
  }

  const request = new Request(url, { redirect: "error" });
  if (request.redirect !== "error") {
    throw new Error("This runtime does not support redirect blocking.");
  }
}
