// Watch and rebuild the entire project on file changes
import chokidar from "chokidar";
import { exec } from "child_process";

const watcher = chokidar.watch(["src", "src/**/*.ts"], {
  ignored: /(^|[\\/\\.])\../, // ignore dotfiles
  persistent: true,
});

function rebuild() {
  console.log("[watch] Detected change. Rebuilding...");
  exec("npm run build", (err, stdout, stderr) => {
    if (err) {
      console.error(`[watch] Build error: ${stderr}`);
    } else {
      console.log("[watch] Build complete.");
      if (stdout) console.log(stdout);
    }
  });
}

watcher.on("ready", () => {
  console.log("[watch] Watching for changes in src/ ...");
  watcher.on("all", (event, path) => {
    rebuild();
  });
});
