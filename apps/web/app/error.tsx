'use client' // Error boundaries must be Client Components
 
import { useEffect } from 'react'
import { Button } from '@repo/ui/button'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])
 
  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-texture px-6 py-10 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-center shadow-[0_18px_30px_-24px_rgba(31,41,55,0.4)]">
        <h2 className="font-display text-xl font-bold">Something went wrong!!!</h2>
        <Button
          buttonType="ink"
          className="mt-4 justify-center"
          innerClassName="w-full"
          onClick={() => reset()}
        >
          Try again
        </Button>
      </div>
    </main>
  )
}
