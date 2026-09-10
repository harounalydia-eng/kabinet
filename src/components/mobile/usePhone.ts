import { useEffect, useState } from 'react'

/** True below the sm breakpoint (640px) — the dedicated phone composition. */
export function usePhone(): boolean {
  const [is, setIs] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false))
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const on = () => setIs(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return is
}
