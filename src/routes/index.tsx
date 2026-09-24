import { createFileRoute } from "@tanstack/react-router";
import { NinthGate } from "@/components/NinthGate";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <NinthGate />;
}
