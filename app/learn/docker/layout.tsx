import { createPageMetadata, LEARNING_SEO } from "../../seo";

export const metadata = createPageMetadata(LEARNING_SEO.docker);

export default function DockerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
