const API =
  process.env.NEXT_PUBLIC_GAS_URL!;

export async function getLineups() {

  const res = await fetch(
    `${API}?action=alineaciones`,
    {
      cache: "no-store",
    }
  );

  return await res.json();

}