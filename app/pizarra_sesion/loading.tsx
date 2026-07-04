export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        <p className="text-white/70">
          Cargando pizarra...
        </p>
      </div>
    </div>
  );
}