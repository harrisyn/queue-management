-- CreateTable
CREATE TABLE "DisplayPlaylist" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "days" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "startTime" TEXT,
    "endTime" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisplayPlaylist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisplayPlaylistItem" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DisplayPlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisplayPlaylist_organizationId_locationId_idx" ON "DisplayPlaylist"("organizationId", "locationId");
CREATE UNIQUE INDEX "DisplayPlaylistItem_playlistId_mediaId_key" ON "DisplayPlaylistItem"("playlistId", "mediaId");

-- AddForeignKey
ALTER TABLE "DisplayPlaylist" ADD CONSTRAINT "DisplayPlaylist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisplayPlaylist" ADD CONSTRAINT "DisplayPlaylist_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisplayPlaylistItem" ADD CONSTRAINT "DisplayPlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "DisplayPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisplayPlaylistItem" ADD CONSTRAINT "DisplayPlaylistItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "DisplayMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
