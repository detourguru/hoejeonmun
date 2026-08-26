export async function registerNode() {
  const { setDefaultResultOrder } = await import("node:dns");

  setDefaultResultOrder("ipv4first");
}
