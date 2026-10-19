export function WelcomeScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section
        aria-labelledby="welcome-title"
        className="w-full max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm sm:p-12"
      >
        <div
          aria-hidden="true"
          className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900 text-2xl font-semibold text-white"
        >
          C
        </div>
        <p className="mb-3 text-sm font-medium tracking-wide text-emerald-900">TU AGENDA ESCOLAR</p>
        <h1
          id="welcome-title"
          className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl"
        >
          ClassNote
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-stone-600">
          Un espacio para acompañar el día a día de tu grupo.
        </p>
        <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-700" />
          Funciona sin conexión a internet
        </p>
        <p className="mt-8 border-t border-stone-200 pt-6 text-sm leading-relaxed text-stone-600">
          Bienvenida a ClassNote. Estamos preparando las herramientas para organizar tu trabajo
          escolar. Esta versión inicial todavía no permite registrar información.
        </p>
      </section>
    </main>
  );
}
