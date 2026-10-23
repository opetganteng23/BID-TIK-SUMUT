import { Marquee } from "@/components/site/Marquee";
import { AboutSection, FeaturesSection, HeroSection, NewsSection } from "@/components/site/HomeSections";
import { getPublicSettings } from "@/lib/settings";

export default async function Home() {
  const settings = await getPublicSettings();
  const order = settings.sections.filter((s) => s.enabled);

  return (
    <>
      <h1 className="sr-only">{settings.siteName}</h1>
      {order.map((section) => (
        <div key={section.key}>
          {section.key === "hero" && <HeroSection />}
          {section.key === "about" && <AboutSection section={section} />}
          {section.key === "news" && <NewsSection section={section} count={settings.newsHomeCount} category={settings.newsHomeCategory} />}
          {section.key === "features" && <FeaturesSection section={section} />}
          {settings.marquees.filter((m) => m.after === section.key).map((m) => (
            <Marquee key={m.id} marquee={m} />
          ))}
        </div>
      ))}
    </>
  );
}
