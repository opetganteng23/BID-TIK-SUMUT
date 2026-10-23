import { Container, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="pb-8 pt-28" >
      <div aria-busy="true" aria-label="Memuat" className="space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
        <div className="grid gap-6 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </Container>
  );
}
