import { redirect } from "next/navigation";

/* Visionados vive como pestaña de Scout Individual (06/11/2026). */
export default function Visionados() {
  redirect("/scout-rival-individual?vista=visionados");
}
