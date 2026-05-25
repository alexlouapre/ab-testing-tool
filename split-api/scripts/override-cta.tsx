// Code Override Framer — Override CTA universel (tous tests, toutes variantes)
// Utilise useEffect + event listener natif pour intercepter les clics CTA
// Appliquer sur n'importe quel element de chaque page de test
import { useEffect } from "react"
import { Override } from "framer"

let beaconSent = false

function sendSplitBeacons() {
    if (beaconSent) return
    beaconSent = true
    const cookies = document.cookie.split(";")
    for (const c of cookies) {
        const [name, variant] = c.trim().split("=")
        if (name.startsWith("split_") && variant) {
            const testId = name.slice(6).replace(/_/g, "-")
            const url = `https://split-api-one.vercel.app/api/track?test=${testId}&variant=${variant}&event=clic_main_cta`
            let queued = false
            try {
                queued = navigator.sendBeacon(url)
            } catch {}
            if (!queued) {
                try {
                    fetch(url, {
                        method: "GET",
                        keepalive: true,
                        mode: "no-cors",
                    }).catch(() => {})
                } catch {}
            }
        }
    }
}

const CTA_PATH_RE =
    /poppins\.io\/(compatibilite|eligibilite)(-[a-z0-9]+)?(\?|\/|$)/i

export function PushDataLayerEvent(): Override {
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            // Ignore modifier-clicks (cmd/ctrl/shift/middle) : le navigateur ouvre un nouvel onglet,
            // la page reste vivante, donc sendBeacon flush normalement — rien a intercepter
            if (
                e.button !== 0 ||
                e.ctrlKey ||
                e.metaKey ||
                e.shiftKey ||
                e.altKey
            )
                return

            const link = (e.target as HTMLElement).closest("a")
            if (!link || !link.href || !CTA_PATH_RE.test(link.href)) return

            if (window.dataLayer) {
                window.dataLayer.push({ event: "clic_main_cta" })
            }
            sendSplitBeacons()

            // target="_blank" : nouvel onglet, page actuelle reste en vie → pas besoin de delay
            if (link.target === "_blank") return

            // Navigation same-tab cross-origin : si on laisse faire,
            // le unload coupe le beacon avant qu'il parte (surtout dans les in-app browsers
            // Instagram / Facebook / TikTok). On intercepte et on navigue apres 150ms
            // pour laisser le temps au beacon de partir.
            e.preventDefault()
            const targetUrl = link.href
            setTimeout(() => {
                window.location.href = targetUrl
            }, 150)
        }
        document.addEventListener("click", handleClick, true)
        return () => document.removeEventListener("click", handleClick, true)
    }, [])
    return {}
}
