/* next/font/google fuera de Next (comprobaciones en Node): cada fuente da un objeto vacío. */
const fuente = () => ({ className: "", variable: "", style: { fontFamily: "sans-serif" } });

/* «then» y «__esModule» no son fuentes: si lo fueran, el import se tomaría por una promesa y no acabaría nunca. */
module.exports = new Proxy({}, { get: (_, k) => (k === "then" || typeof k === "symbol" || k === "__esModule" || k === "default" ? undefined : fuente) });
