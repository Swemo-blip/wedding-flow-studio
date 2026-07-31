import type { Metadata } from "next";
import { PhotoShotList } from "@/components/photos/photo-shot-list";

export const metadata: Metadata = {
  title: "Photos",
  description: "Write the group-photograph shot list your photographer will ask for, naming exactly who stands in each picture."
};

export default function PhotosPage() {
  return <PhotoShotList />;
}
