export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Echon
        </h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">
          AI-powered Instagram DM automation
        </p>
        <a
          href="/login"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Sign in
        </a>
      </div>
    </div>
  );
}
