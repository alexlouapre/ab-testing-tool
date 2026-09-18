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

// Deux motifs distincts, volontairement (18/09/2026, test rentree-26-v2).
//
// CTA_PATH_RE gouverne le push dataLayer, donc les tags GTM 244 (event GA4
// clic_main_cta) et 319 (pixel TikTok ClicMainCTA). Il n'est PAS elargi, pour
// ne pas creer de rupture dans l'historique GA4 ni envoyer de nouveaux signaux
// a TikTok. Aucun tag Meta n'ecoute cet event (verifie dans GTM-T59MRZ6B).
//
// SPLIT_CTA_RE gouverne le beacon de split et le delai de navigation. Il est
// plus large : il ajoute les liens vers une page de slug se terminant par
// "-offres", pour que le bras "direct" d'un test (LP vers page offres) soit
// compte comme le bras "questionnaire" (LP vers eligibilite). Sans ca, le bras
// direct remonte 0 clic. C'est ce qui est arrive au test 10 en juin 2026 :
// sp-26-dir est reste a 0,25% de CTR pendant tout le test.
//
// CTA_PATH_RE est un sous-ensemble strict de SPLIT_CTA_RE, donc le
// comportement des liens deja couverts est inchange.
const CTA_PATH_RE =
    /poppins\.io\/(compatibilite|eligibilite)(-[a-z0-9]+)*(\?|\/|$)/i

const SPLIT_CTA_RE =
    /poppins\.io\/(?:(?:compatibilite|eligibilite)(?:-[a-z0-9]+)*|[a-z0-9-]+-offres)(?:\?|\/|$)/i

export function PushDataLayerEvent(): Override {
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            // Ignore modifier-clicks (cmd/ctrl/shift/middle) : le navigateur ouvre un nouvel onglet,
            // la page reste vivante, donc sendBeacon flush normalement, rien a intercepter
            if (
                e.button !== 0 ||
                e.ctrlKey ||
                e.metaKey ||
                e.shiftKey ||
                e.altKey
            )
                return

            const link = (e.target as HTMLElement).closest("a")
            if (!link || !link.href || !SPLIT_CTA_RE.test(link.href)) return

            // Le dataLayer ne recoit que les liens de l'ancien perimetre
            if (CTA_PATH_RE.test(link.href) && window.dataLayer) {
                window.dataLayer.push({ event: "clic_main_cta" })
            }
            sendSplitBeacons()

            // target="_blank" : nouvel onglet, page actuelle reste en vie, pas besoin de delay
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
