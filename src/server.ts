import "dotenv/config";
import { createApp } from "./app.js";
import { prisma } from "./db/prisma.js";
import { PrismaRepository } from "./db/prismaRepository.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp(new PrismaRepository(prisma));

app.listen(port, () => {
  console.log(`Rentotal API listening on http://localhost:${port}`);
});
