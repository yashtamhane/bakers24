// Business facts shown on the site, copied from CONTENT.md (user-supplied screenshots).
// Only facts CONTENT.md gives without an open question are published here. Deliberately left
// out until the shop confirms them: opening hours (conflicting sources), email (contact
// preference unknown), delivery coverage, and a map pin (exact storefront not yet verified).

const WHATSAPP_E164 = "919028902800";

export const business = {
  name: "Baker’s 24",
  descriptor: "Pure Veg Cake Shop",
  address: {
    lines: ["Sadhu Vaswani Rd, Shastri Nagar", "Pimpri Colony, Pimpri-Chinchwad", "Maharashtra 411017"],
    /** Spelling and exact storefront still to be confirmed (CONTENT.md). */
    verified: false,
  },
  whatsapp: {
    display: "+91 90289 02800",
    /** Opens a chat only; no message is pre-filled or sent. */
    href: `https://wa.me/${WHATSAPP_E164}`,
    source: "Instagram bio",
  },
  instagram: {
    handle: "@bakers24pcmc",
    href: "https://www.instagram.com/bakers24pcmc/",
  },
} as const;

/** Required wording from CONTENT.md (“Demo safety”). */
export const conceptNotice = "Concept demonstration — products, prices and availability subject to confirmation.";
