'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

const HIDE_SIDEBAR_PREFIXES = ['/help-center', '/release-notes', '/policies']

export default function SidebarWrapper() {
    const pathname = usePathname() || '/'
    const shouldHide = HIDE_SIDEBAR_PREFIXES.some((p) => pathname.startsWith(p))
    if (shouldHide) return null
    return <Sidebar />
}