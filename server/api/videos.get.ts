// server/api/videos.get.ts
import { db } from '../database/db'
import { videos, communities } from '../database/schema'
import { eq, desc } from 'drizzle-orm'
import type { ApiVideoDto } from '~~/shared/types/api'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event): Promise<ApiVideoDto[]> => {
  console.log('[API] GET /api/videos')
  
  const result = await db
    .select({
      id: videos.id,
      url: videos.url,
      title: videos.title,
      addedAt: videos.addedAt,
      communityId: videos.communityId,
      communityName: communities.name,
    })
    .from(videos)
    .leftJoin(communities, eq(videos.communityId, communities.id))
    .orderBy(desc(videos.addedAt))

  return result
})
