import { atom } from 'jotai'

import type { Record } from '@/lib/types'

export const queryAtom = atom('')
export const whereFilterAtom = atom('')
export const currentPageAtom = atom(1)
export const selectedRecordAtom = atom<Record | null>(null)
export const detailPanelOpenAtom = atom<boolean>(true)
