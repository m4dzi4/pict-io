-- CreateTable
CREATE TABLE "Keyword" (
    "id" SERIAL NOT NULL,
    "word" TEXT NOT NULL,
    "category" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_word_key" ON "Keyword"("word");
