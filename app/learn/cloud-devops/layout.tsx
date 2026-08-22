import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO["cloud-devops"]);

export default function CloudDevopsLearningLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
