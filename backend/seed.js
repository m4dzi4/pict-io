const { PrismaClient } = require("./generated/prisma");

const prisma = new PrismaClient();

const keywords = [
	// Animals
	{ word: "cat", category: "animals", difficulty: 1 },
	{ word: "dog", category: "animals", difficulty: 1 },
	{ word: "elephant", category: "animals", difficulty: 2 },
	{ word: "butterfly", category: "animals", difficulty: 3 },
	{ word: "rhinoceros", category: "animals", difficulty: 4 },
	{ word: "platypus", category: "animals", difficulty: 5 },

	// Objects
	{ word: "car", category: "objects", difficulty: 1 },
	{ word: "house", category: "objects", difficulty: 1 },
	{ word: "bicycle", category: "objects", difficulty: 2 },
	{ word: "telescope", category: "objects", difficulty: 3 },
	{ word: "microscope", category: "objects", difficulty: 4 },
	{ word: "stethoscope", category: "objects", difficulty: 5 },

	// Food
	{ word: "apple", category: "food", difficulty: 1 },
	{ word: "pizza", category: "food", difficulty: 1 },
	{ word: "sandwich", category: "food", difficulty: 2 },
	{ word: "spaghetti", category: "food", difficulty: 3 },
	{ word: "croissant", category: "food", difficulty: 4 },
	{ word: "bouillabaisse", category: "food", difficulty: 5 },

	// Actions
	{ word: "running", category: "actions", difficulty: 1 },
	{ word: "jumping", category: "actions", difficulty: 1 },
	{ word: "swimming", category: "actions", difficulty: 2 },
	{ word: "painting", category: "actions", difficulty: 3 },
	{ word: "meditating", category: "actions", difficulty: 4 },
	{ word: "procrastinating", category: "actions", difficulty: 5 },

	// Nature
	{ word: "tree", category: "nature", difficulty: 1 },
	{ word: "flower", category: "nature", difficulty: 1 },
	{ word: "mountain", category: "nature", difficulty: 2 },
	{ word: "waterfall", category: "nature", difficulty: 3 },
	{ word: "aurora", category: "nature", difficulty: 4 },
	{ word: "stalactite", category: "nature", difficulty: 5 },

	// Emotions
	{ word: "happy", category: "emotions", difficulty: 2 },
	{ word: "sad", category: "emotions", difficulty: 2 },
	{ word: "angry", category: "emotions", difficulty: 2 },
	{ word: "confused", category: "emotions", difficulty: 3 },
	{ word: "nostalgic", category: "emotions", difficulty: 4 },
	{ word: "melancholic", category: "emotions", difficulty: 5 },

	// Professions
	{ word: "doctor", category: "professions", difficulty: 2 },
	{ word: "teacher", category: "professions", difficulty: 2 },
	{ word: "firefighter", category: "professions", difficulty: 3 },
	{ word: "archaeologist", category: "professions", difficulty: 4 },
	{ word: "neurosurgeon", category: "professions", difficulty: 5 },

	// Movies/Entertainment
	{ word: "movie", category: "entertainment", difficulty: 1 },
	{ word: "concert", category: "entertainment", difficulty: 2 },
	{ word: "theater", category: "entertainment", difficulty: 3 },
	{ word: "orchestra", category: "entertainment", difficulty: 4 },
	{ word: "cinematography", category: "entertainment", difficulty: 5 },

	// Sports
	{ word: "football", category: "sports", difficulty: 1 },
	{ word: "basketball", category: "sports", difficulty: 2 },
	{ word: "volleyball", category: "sports", difficulty: 2 },
	{ word: "badminton", category: "sports", difficulty: 3 },
	{ word: "synchronized swimming", category: "sports", difficulty: 5 },

	// Abstract concepts
	{ word: "love", category: "abstract", difficulty: 3 },
	{ word: "freedom", category: "abstract", difficulty: 4 },
	{ word: "justice", category: "abstract", difficulty: 4 },
	{ word: "serenity", category: "abstract", difficulty: 5 },
	{ word: "existentialism", category: "abstract", difficulty: 5 },
];

async function main() {
	console.log("Start seeding keywords...");

	for (const keyword of keywords) {
		try {
			const result = await prisma.keyword.upsert({
				where: { word: keyword.word },
				update: {},
				create: keyword,
			});
			console.log(`Created/Updated keyword: ${result.word}`);
		} catch (error) {
			console.error(`Error with keyword ${keyword.word}:`, error.message);
		}
	}

	console.log("Seeding finished.");
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
