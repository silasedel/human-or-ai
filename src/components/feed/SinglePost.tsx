"use client";

import { useState } from "react";
import type { PostDTO } from "@/lib/feed";
import { PostCard } from "@/components/feed/PostCard";

export function SinglePost({ post: initial }: { post: PostDTO }) {
  const [post, setPost] = useState(initial);
  return <PostCard post={post} onChange={setPost} standalone />;
}
