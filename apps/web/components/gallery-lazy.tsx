"use client";
import dynamic from "next/dynamic";
export const GalleryLazy = dynamic(() => import("./content-gallery").then(m => m.ContentGallery), { loading: () => <div className="mt-6 min-h-32" aria-label="正在加载图集" /> });
