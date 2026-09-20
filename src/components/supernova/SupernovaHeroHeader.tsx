import PageHeader from "@/components/PageHeader";

interface Props {
  title: string;
  subtitle: string;
}

// The page title block used by two dozen screens. It used to be a large glowing
// card (36px heading, 24px padding, a pulsing gradient behind it, 40px of margin
// below), which took roughly a third of a laptop screen and more on a phone
// before any content appeared. It now IS the compact PageHeader, so every
// screen that used it gets the same slim, consistent title row.
export function SupernovaHeroHeader({ title, subtitle }: Props) {
  return <PageHeader title={title} subtitle={subtitle} />;
}
