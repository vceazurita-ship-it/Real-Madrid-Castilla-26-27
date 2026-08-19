import type { Metadata } from "next";
import SeasonWorkspace from "@/components/season/SeasonWorkspace";

export const metadata: Metadata = {
  title: "Área Condicional · RMCF Castilla",
};

export default function PerformancePage() {
  return <SeasonWorkspace area="performance" />;
}
