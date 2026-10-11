import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO.networking);

export default function NetworkingLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
