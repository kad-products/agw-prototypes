/**
 * useStepHistory
 *
 * Wires up browser back/forward for a single-page multi-step prototype.
 *
 * - On first mount: replaces the current URL with the initial query (no new
 *   history entry).
 * - On every forward step change: pushes a new history entry so the browser
 *   back button can navigate between steps.
 * - When the URL changes due to browser back/forward (not our own push):
 *   calls onBack with the new URL query so the component can restore its state.
 *
 * Usage:
 *   useStepHistory('/statements', buildQuery(state), (q) =>
 *     dispatch({ type: 'RESTORE_STATE', step: q.step as Step, ... })
 *   )
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import type { ParsedUrlQuery } from 'querystring'

function queryKey(q: Record<string, string>): string {
  return Object.entries(q)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}

function routerQueryKey(q: ParsedUrlQuery): string {
  return Object.entries(q)
    .filter((e): e is [string, string] => typeof e[1] === 'string')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}

export function useStepHistory(
  pathname: string,
  query: Record<string, string>,
  onBack: (query: ParsedUrlQuery) => void,
): void {
  const router = useRouter()

  // onBack may be a new function reference each render; keep a ref so we
  // always call the latest version without it being a dependency.
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack

  const isMountedRef = useRef(false)
  const isRestoringRef = useRef(false)
  // The key of the last query we pushed/replaced — used to distinguish our
  // own navigation from browser back/forward.
  const lastOwnKeyRef = useRef<string>('')

  const currentKey = queryKey(query)

  // URL sync: replace on mount / restore, push on forward navigation.
  useEffect(() => {
    lastOwnKeyRef.current = currentKey

    if (!isMountedRef.current) {
      isMountedRef.current = true
      router.replace({ pathname, query }, undefined, { shallow: true })
      return
    }
    if (isRestoringRef.current) {
      isRestoringRef.current = false
      router.replace({ pathname, query }, undefined, { shallow: true })
      return
    }
    router.push({ pathname, query }, undefined, { shallow: true })
  // currentKey is a stable string derived from query contents; pathname
  // and router don't change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey])

  // Back detection: fires when router.query changes for any reason.
  // If the new URL matches our last push it was ours — ignore it.
  // Otherwise the browser navigated and we should restore state.
  const rqKey = routerQueryKey(router.query)
  useEffect(() => {
    if (!router.isReady) return
    if (rqKey === lastOwnKeyRef.current) return

    isRestoringRef.current = true
    onBackRef.current(router.query)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rqKey])
}
