import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { getPageBySlug } from "@/lib/public-data";
import { isReservedSlug } from "@/lib/slug";

type Props = PageProps<"/[slug]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const p = isReservedSlug(slug) ? null : await getPageBySlug(slug);
  if (!p) return { title: "Halaman tidak ditemukan" };
  return { title: p.seo?.title || p.title, description: p.seo?.description, alternates: { canonical: `/${p.slug}` } };
}

export default async function StaticPage(props: Props) {
  const { slug } = await props.params;
  if (isReservedSlug(slug)) notFound();
  const p = await getPageBySlug(slug);
  if (!p) notFound();
  return (
    <Container className="pb-8 pt-28">
      <h1 className="mb-8 text-4xl md:text-5xl">{p.title}</h1>
      <div className="prose-article" dangerouslySetInnerHTML={{ __html: p.contentHtml ?? "" }} />
    </Container>
  );
}
