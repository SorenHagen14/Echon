export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 pt-10 pb-16 dark:bg-zinc-950">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <span className="text-2xl font-semibold text-zinc-900 dark:text-white">Echon</span>
        </div>
        {children}
      </div>
    </div>
  )
}
