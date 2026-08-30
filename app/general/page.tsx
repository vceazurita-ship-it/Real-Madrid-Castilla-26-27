import type { Metadata } from "next";
import SeasonWorkspace from "@/components/season/SeasonWorkspace";

export const metadata: Metadata = {
  title: "Área General · RMCF Castilla",
};

export default function GeneralPage() {
  return <SeasonWorkspace area="general" />;
}
  