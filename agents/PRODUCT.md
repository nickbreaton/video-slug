# VideoSlug Product Overview

VideoSlug is a Progressive Web App (PWA) for building a personal video library. Add videos from around the web to your library and optionally download them to your device for offline viewing.

## Core Concept

Videos in VideoSlug exist in two layers:

1. **Library** (Server) - Videos saved to your personal library, streamable with an internet connection
2. **Device** (Local) - Videos downloaded to your device for offline viewing (e.g., on a plane)

## Vocabulary

| Term | Meaning |
|------|---------|
| **Library** | Your personal collection of saved videos on the server |
| **Adding to library** | Server is fetching and saving a video to your library |
| **Save to device** | Download a video locally for offline access |
| **Saving to device** | Local download in progress |
| **Offline** | Video is available on device without internet |

## Video States

A video progresses through these states:

### Server States (Library)
- **Downloading** - Video is being added to your library. Shows progress percentage. Streaming not yet available.
- **Complete** - Video is in your library and ready to stream.
- **Error** - Something went wrong during the save.

### Device States (Local)
- **Not downloaded** - Video is only in your library (requires internet to watch)
- **Downloading** - Video is being saved to device. Shows progress percentage. Can be cancelled.
- **Offline ready** - Video is saved locally and available without internet

## Video Information

Each video displays:
- **Title** - Name of the video
- **Uploader** - Channel or creator name
- **Duration** - Length in mm:ss or hh:mm:ss format
- **Upload date** - When the video was originally published
- **Description** - Full video description (on detail page)
- **File size** - Total size shown before downloading to device

## Key User Flows

### Adding a Video
1. User provides a video URL
2. Video metadata appears immediately
3. "Adding to library" shows server download progress
4. Once complete, video is streamable from library

### Saving for Offline
1. User taps download icon on a library video
2. "Saving to device" shows local download progress
3. User can cancel if needed
4. Once complete, "Offline" indicator appears
5. Video plays without internet connection

### Removing from Device
1. User taps delete icon on an offline video
2. Local copy is removed
3. Video remains in library (still streamable online)

## Target Users

People who want to build and maintain a personal video collection.

**Example use cases:**

- **Watch later queue** - Finding interesting videos during browsing and saving them to watch when you have time
- **Travel** - Downloading videos before a flight or train trip for offline viewing
- **Limited data** - Saving videos once on WiFi, then streaming without using mobile data
- **Remote areas** - Having access to saved content when internet is spotty or unavailable
- **Privacy** - Users who want their own collection without platform feeds or algorithms

## PWA Considerations

- Sticky navigation that blends into device safe area
- Works offline for downloaded content
- Installable on home screen
