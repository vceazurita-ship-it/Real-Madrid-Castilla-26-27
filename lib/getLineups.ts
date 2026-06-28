const API = "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec"

export async function getLineups() {

  const res = await fetch(
    `${API}?action=alineaciones`,
    {
      cache: "no-store",
    }
  );

  return await res.json();

}