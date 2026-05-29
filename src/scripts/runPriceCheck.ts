import "dotenv/config";
import { prisma } from "../db/prisma.js";
import { PrismaRepository } from "../db/prismaRepository.js";
import { ScheduledPriceCheckService } from "../services/scheduledPriceCheckService.js";
import { runPriceCheckCli } from "./priceCheckRunner.js";

const service = new ScheduledPriceCheckService(new PrismaRepository(prisma));
const result = await runPriceCheckCli(service, process.argv.slice(2));

if (result.output) console.log(result.output);
if (result.error) console.error(result.error);

await prisma.$disconnect();
process.exitCode = result.exitCode;
