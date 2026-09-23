import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-ink px-6 py-16 text-center text-ivory">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(215,170,66,.18),transparent_28%),linear-gradient(135deg,#070707_0%,#11100d_52%,#070707_100%)]" />
      <div className="grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[min(90vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/10 shadow-[0_0_160px_rgba(215,170,66,.08)]" />
      <div className="relative z-10 max-w-xl">
        <Image
          src="/imperio-sofas-logo-384.webp"
          alt="Império Sofás"
          width={120}
          height={120}
          className="mx-auto mb-8 size-24 [clip-path:circle(46%)]"
          priority
        />
        <p className="eyebrow">Página não encontrada · 404</p>
        <h1 className="mt-4 font-display text-5xl font-semibold leading-[.95] sm:text-7xl">
          Esse caminho saiu da rota.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted">
          Respire. O conforto ainda está por aqui — volte para a loja ou
          recomece sua jornada pela página inicial.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/loja"
            className="rounded-full bg-gold px-6 py-3 font-semibold text-ink transition hover:bg-gold-light"
          >
            Explorar a loja
          </Link>
          <Link
            href="/"
            className="rounded-full border border-gold/50 px-6 py-3 font-semibold text-gold transition hover:bg-gold/10"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
