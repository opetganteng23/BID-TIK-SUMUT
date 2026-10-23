import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { FeaturesBrowser } from "@/components/site/FeaturesBrowser";
import { getFeatureCategories, listFeatures } from "@/lib/public-data";

export const metadata: Metadata = { title: "Fitur", alternates: { canonical: "/fitur" } };

export default async function FeaturesIndex() {
  const [features, categories] = await Promise.all([listFeatures(), getFeatureCategories()]);
  return (
    <Container className="pb-8 pt-28">
      <h1 className="mb-8 text-4xl md:text-5xl">Fitur</h1>
      <FeaturesBrowser features={features} categories={categories} />
    </Container>
  );
}
