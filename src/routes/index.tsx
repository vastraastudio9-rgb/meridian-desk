import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/desk/app-shell";
import { getMarketSnapshot } from "@/lib/market/snapshot";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      return await getMarketSnapshot({ data: { interval: "1h" } });
    } catch {
      return null;
    }
  },
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <AppShell initial={initial} />;
}
