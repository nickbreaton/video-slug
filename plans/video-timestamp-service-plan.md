# VideoTimestampService Implementation Plan

## Overview
Create a backend service for storing and retrieving video playback timestamps with cascading delete from the videos table.

## Schema Design

### Database Table: `timestamps`
```sql
CREATE TABLE IF NOT EXISTS timestamps (
  video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  time REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
)
```

### Relationships
- **Primary Key**: `video_id` (references `videos.id`)
- **Foreign Key**: `ON DELETE CASCADE` - automatically deletes timestamps when parent video is deleted
- **No separate index needed** - primary key provides optimal lookup performance

## Service Interface

### VideoTimestampService
```typescript
export class VideoTimestampService extends Effect.Service<VideoTimestampService>()(
  "VideoTimestampService",
  {
    dependencies: [],
    effect: Effect.gen(function* () { ... }),
  },
) {}
```

### Operations
1. **upsert**: Save/overwrite timestamp for a video
   - Request: `PlaybackTimeEntry`
   - Behavior: INSERT with ON CONFLICT UPDATE

2. **getByVideoId**: Retrieve timestamp for a specific video
   - Request: `video_id: string`
   - Response: `Option<PlaybackTimeEntry>`
   - Returns none if no timestamp exists

## Schema Integration

### Current: `PlaybackTimeEntry`
```typescript
export class PlaybackTimeEntry extends Schema.Class<PlaybackTimeEntry>("PlaybackTimeEntry")({
  time: Schema.Number,
  updatedAt: Schema.Number,
}) {}
```

### Enhancement: `EnhancedVideoInfo` with Timestamp
```typescript
export const EnhancedVideoInfo = Schema.Struct({
  info: VideoInfo,
  status: VideoDownloadStatus,
  totalBytes: Schema.Option(Schema.Number),
  timestamp: Schema.Option(PlaybackTimeEntry),
});
```

This allows querying timestamp alongside video data in a single query. Both `totalBytes` and `timestamp` are now `Option` types for consistency.

## Implementation Details

### File: `src/server/services/VideoTimestampService.ts`

```typescript
import { PlaybackTimeEntry } from "@/schema/videos";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { SqlResolver, SqlSchema } from "@effect/sql";
import { Effect, Schema } from "effect";

const VideoTimestamp = Schema.Struct({
  id: Schema.String,
  time: Schema.Number,
  updatedAt: Schema.Number,
});

export class VideoTimestampService extends Effect.Service<VideoTimestampService>()(
  "VideoTimestampService",
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      const sql = yield* SqliteClient.SqliteClient;

      yield* sql`
        CREATE TABLE IF NOT EXISTS timestamps (
          video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
          time REAL NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        )
      `;

      const resolver = SqlResolver.void("UpsertTimestamp", {
        Request: VideoTimestamp,
        execute: (requests) =>
          sql`
            INSERT INTO timestamps (video_id, time, updated_at)
            VALUES (${requests.map(r => r.id)}, ${requests.map(r => r.time)}, ${requests.map(r => r.updatedAt)})
            ON CONFLICT(video_id) DO UPDATE SET
              time = excluded.time,
              updated_at = excluded.updated_at
          `,
      });

      const upsertTimestamp = yield* resolver;

      const getTimestampByVideoId = SqlSchema.findOne({
        Request: Schema.String,
        Result: PlaybackTimeEntry,
        execute: (videoId) => sql`SELECT time, updated_at FROM timestamps WHERE video_id = ${videoId}`,
      });

      return {
        upsert: upsertTimestamp.execute,
        getByVideoId: getTimestampByVideoId,
      };
    }),
  },
) {}
```

## Implementation Notes

1. **Schema Definition**: Used `Schema.Struct` instead of `Schema.Class` to define the request shape for the upsert operation, with `id` (video_id), `time`, and `updatedAt` fields.

2. **Resolver Pattern**: Used `yield* resolver` pattern to properly unwrap the Effect returned by `SqlResolver.void()`.

3. **Table Creation**: Created with `IF NOT EXISTS` for safe migration and `ON DELETE CASCADE` for automatic cleanup.

4. **Upsert Logic**: Uses SQLite's `ON CONFLICT` clause for efficient upsert without needing separate insert/update operations.

5. **Query Results**: Returns `PlaybackTimeEntry` (without `id` field) from queries, keeping the schema consistent with the existing client-side usage.

## Integration with VideoRepo

To include timestamps in enhanced video data, `VideoTimestampService` is integrated into `VideoRepo`.

### Changes Made

**1. Schema Update: `src/schema/videos.ts`**
```typescript
export const EnhancedVideoInfo = Schema.Struct({
  info: VideoInfo,
  status: VideoDownloadStatus,
  totalBytes: Schema.Option(Schema.Number),
  timestamp: Schema.Option(PlaybackTimeEntry),
});
```

**2. Service Update: `src/server/services/VideoRepo.ts`**

- Added import for `VideoTimestampService`
- Added `VideoTimestampService.Default` to dependencies
- Fetch timestamp in `enhanceVideo` function:
```typescript
const timestampOption = yield* timestampService.getByVideoId(video.id);

const result: typeof EnhancedVideoInfo.Type = {
  info: video,
  status: hasFile ? "complete" : hasStream ? "downloading" : "error",
  totalBytes: Option.map(stat, (s) => Number(s.size)),
  timestamp: timestampOption,
};
```

**3. Client Updates: `src/client/components/`**

- Updated `atoms.ts` to handle `Option<number>` for `totalBytes`
- Updated `App.tsx` to include `Option.none()` for fallback video objects

### Result

After integration:
- `getAll()` and `getById()` return videos with `totalBytes: Option<number>` and `timestamp: Option<PlaybackTimeEntry>`
- Use `Option.map`/`Option.getOrElse` to extract values
- Missing values remain as `Option.none()` (not `undefined`)
- Cascading delete continues to work automatically

## Usage Examples

### Save Timestamp
```typescript
const timestampService = yield* VideoTimestampService;

yield* timestampService.upsert({
  id: videoId,
  time: 125.5, // seconds
  updatedAt: Date.now(),
});
```

### Retrieve Timestamp
```typescript
const timestampOption = yield* timestampService.getByVideoId(videoId);

// Option.some if exists, Option.none if not
const time = Option.getOrElse(timestampOption, () => 0);
```

### With EnhancedVideoInfo Integration
```typescript
// getAll() and getById() now return EnhancedVideoInfo with timestamp included
const enhancedVideo = yield* videoRepo.getById(videoId);
// enhancedVideo: { info: VideoInfo, status: "...", totalBytes: Option<number>, timestamp: Option<PlaybackTimeEntry> }

// Access timestamp
if (Option.isSome(enhancedVideo.timestamp)) {
  console.log("Saved time:", enhancedVideo.timestamp.value.time);
}
```

## Error Handling
- **Foreign Key Errors**: Propagate naturally - attempting to save timestamp for non-existent video will fail
- **Database Errors**: Propagate to caller for handling
- **Missing Timestamps**: Return `Option.none` (not an error)

## Migration Strategy
1. Service creates table on first initialization
2. No migration needed for existing databases - table is created IF NOT EXISTS
3. Cascading delete handles existing video deletions automatically

## Benefits
1. **Data Integrity**: Foreign key constraint ensures valid video references
2. **Automatic Cleanup**: Cascading delete prevents orphaned timestamp records
3. **Efficient**: Primary key lookup is O(1) for timestamp retrieval
4. **Consistent**: Uses same Effect/Schema patterns as VideoRepo
5. **Simple**: No additional dependencies required
