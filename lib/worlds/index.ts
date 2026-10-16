import type { Builder, Kit, World } from "./kit";

// Each world is its own chunk, fetched only when its floor is chosen (or prefetched while idle in the cabin).
const modules: Record<number, () => Promise<{ default: Builder }>> = {
  1: () => import("./tokyo"),
  2: () => import("./ocean"),
  3: () => import("./space"),
  4: () => import("./forest"),
  5: () => import("./arcade"),
  6: () => import("./garden"),
  7: () => import("./library"),
  8: () => import("./frozen"),
  9: () => import("./dream"),
  10: () => import("./forbidden"),
  11: () => import("./sunset"),
  12: () => import("./skyline"),
  13: () => import("./digital"),
};

export async function loadWorld(floor: number, kit: Kit): Promise<World> {
  const load = modules[floor];
  if (!load) throw new Error(`No world for floor ${floor}`);
  const { default: build } = await load();
  return build(kit);
}

export function prefetchWorlds() {
  for (const load of Object.values(modules)) void load().catch(() => {});
}
