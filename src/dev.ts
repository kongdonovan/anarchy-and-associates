import { DIService, MetadataStorage } from "discordx";
import { bot } from "./bot.js";
import { config as envConfig } from "dotenv";
import path from "node:path";
import watch from "node-watch";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Glob pattern for commands and events
const importPattern = path.posix.join(
  __dirname.replace(/\\/g, "/"),
  "{commands,events}",
  "**",
  "*.ts"
);

/**
 * Load all files matching the pattern
 *
 * @param src glob pattern
 */
async function loadFiles(src: string): Promise<void> {
  const { resolve } = await import("@discordx/importer");
  const files = await resolve(src);
  await Promise.all(
    files.map((file) => import(`${file}?version=${Date.now().toString()}`))
  );
}

/**
 * Reload Discordx metadata and events
 */
async function reload() {
  console.log("> Reloading modules\n");
  bot.removeEvents();
  MetadataStorage.clear();
  DIService.engine.clearAllServices();
  await loadFiles(importPattern);
  await MetadataStorage.instance.build();
  await bot.initApplicationCommands();
  bot.initEvents();
  console.log("> Reload success\n");
}

/**
 * Main entrypoint
 */
async function run() {
  envConfig();
  await loadFiles(importPattern);
  if (!process.env.BOT_TOKEN) {
    throw Error("Could not find BOT_TOKEN in your environment");
  }
  await bot.login(process.env.BOT_TOKEN);

  // Hot reload in development
  if (process.env.NODE_ENV !== "production") {
    console.log(
      "> Hot-Module-Reload enabled in development. Project will rebuild and reload on changes."
    );
    console.log(`Watching src/ for changes...`);
    watch(
      "src",
      { recursive: true },
      async (evt, filename) => {
        console.log(`[${evt}] ${filename}`);
        try {
          // Rebuild the entire project before reload
          const { exec } = await import("child_process");
          await new Promise((resolve, reject) => {
            exec("npx tsc", (err, stdout, stderr) => {
              if (err) {
                console.error("[build error]", stderr);
                reject(err);
              } else {
                if (stdout) console.log(stdout);
                resolve(undefined);
              }
            });
          });
          await reload();
        } catch (err) {
          console.error(err);
        }
      }
    );
  }
}

void run();

// global console, process
