import { ThrowInsDashboard } from "@/components/throw-ins/ThrowInsDashboard";

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1250621633&single=true&output=csv";

export default function ThrowInsDefPage() {
  return <ThrowInsDashboard csvUrl={CSV_URL} title="Saque de Banda Defensivo" mode="defensive" />;
}
