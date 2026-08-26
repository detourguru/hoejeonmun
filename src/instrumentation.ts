export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { setDefaultResultOrder } = await import("node:dns");

  setDefaultResultOrder("ipv4first");
}
