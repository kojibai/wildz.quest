import { WildzApp } from "@/features/shell/WildzApp";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${WILDZ_PRODUCT.origin}/#website`,
      url: WILDZ_PRODUCT.origin,
      name: WILDZ_PRODUCT.name,
      description: WILDZ_PRODUCT.description,
      inLanguage: "en-US"
    },
    {
      "@type": ["VideoGame", "SoftwareApplication"],
      "@id": `${WILDZ_PRODUCT.origin}/#game`,
      name: WILDZ_PRODUCT.name,
      alternateName: "Wildz Quest",
      url: WILDZ_PRODUCT.origin,
      description: WILDZ_PRODUCT.description,
      image: `${WILDZ_PRODUCT.origin}${WILDZ_PRODUCT.discoveryImage}`,
      applicationCategory: "GameApplication",
      applicationSubCategory: "Creature collecting adventure game",
      operatingSystem: "Any modern web browser",
      browserRequirements: "Requires JavaScript, WebGL, and a modern browser",
      isAccessibleForFree: true,
      genre: ["Adventure", "Creature collecting", "Role-playing", "Virtual pet"],
      playMode: ["SinglePlayer", "MultiPlayer"],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/OnlineOnly",
        url: WILDZ_PRODUCT.origin
      },
      publisher: {
        "@type": "Organization",
        name: WILDZ_PRODUCT.name,
        url: WILDZ_PRODUCT.origin,
        logo: `${WILDZ_PRODUCT.origin}/icons/icon-512.png`
      }
    },
    {
      "@type": "WebPage",
      "@id": `${WILDZ_PRODUCT.origin}/#page`,
      url: WILDZ_PRODUCT.origin,
      name: WILDZ_PRODUCT.title,
      description: WILDZ_PRODUCT.description,
      isPartOf: { "@id": `${WILDZ_PRODUCT.origin}/#website` },
      mainEntity: { "@id": `${WILDZ_PRODUCT.origin}/#game` },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: `${WILDZ_PRODUCT.origin}${WILDZ_PRODUCT.discoveryImage}`,
        width: 1280,
        height: 720,
        caption: "An explorer bonding with a living Wildz creature in an emerald wilderness"
      },
      inLanguage: "en-US"
    }
  ]
};

export default function HomePage() {
  return (
    <>
      <section className="sr-only" aria-labelledby="wildz-search-title">
        <h1 id="wildz-search-title">Wildz living creature adventure game</h1>
        <p>Catch one-of-one living creatures shaped by their discovery moment. Explore an endless browser world, talk with intelligent companions, train, bond, evolve, breed, battle, trade, and carry each verified creature card across devices.</p>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <WildzApp />
    </>
  );
}
