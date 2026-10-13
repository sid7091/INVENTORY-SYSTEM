-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "status" TEXT NOT NULL DEFAULT 'active',
    "phone" TEXT,
    "company" TEXT,
    "city" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slab" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "material" TEXT,
    "color" TEXT,
    "size" TEXT NOT NULL,
    "quantity" TEXT,
    "block" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Slab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlabImage" (
    "id" TEXT NOT NULL,
    "slabId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "path" TEXT NOT NULL,
    "thumbPath" TEXT,
    "label" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "SlabImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockKey" (
    "key" TEXT NOT NULL,
    "slabId" TEXT NOT NULL,

    CONSTRAINT "BlockKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Selection" (
    "userId" TEXT NOT NULL,
    "slabId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("userId","slabId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Slab_status_idx" ON "Slab"("status");

-- CreateIndex
CREATE INDEX "SlabImage_slabId_position_idx" ON "SlabImage"("slabId", "position");

-- CreateIndex
CREATE INDEX "SlabImage_createdAt_idx" ON "SlabImage"("createdAt");

-- CreateIndex
CREATE INDEX "BlockKey_slabId_idx" ON "BlockKey"("slabId");

-- AddForeignKey
ALTER TABLE "Slab" ADD CONSTRAINT "Slab_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlabImage" ADD CONSTRAINT "SlabImage_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "Slab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockKey" ADD CONSTRAINT "BlockKey_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "Slab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_slabId_fkey" FOREIGN KEY ("slabId") REFERENCES "Slab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
