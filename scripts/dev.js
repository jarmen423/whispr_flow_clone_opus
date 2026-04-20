const { spawn } = require("child_process");
const net = require("net");

function findPort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        findPort(startPort + 1).then(resolve, reject);
      } else {
        reject(err);
      }
    });
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function main() {
  const port = await findPort(3000);
  console.log(`Starting LocalFlow on http://localhost:${port}`);
  const child = spawn("next", ["dev", "-p", String(port)], {
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => process.exit(code));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
