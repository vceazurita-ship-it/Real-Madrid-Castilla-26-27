import { redirect } from "next/navigation";

/**
 * 25/11/2026: «El balón parado de cada liga» salió del Laboratorio de ABP a la
 * app (Balón Parado → ABP en datos, pestaña Ligas · Wyscout), para todo el
 * staff. La dirección vieja lleva allí.
 */
export default function DatosAbpViejo() {
  redirect("/abp-datos?tab=ligas");
}
