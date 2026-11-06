// Pone el ícono y los datos de la app en el .exe (electron-builder no lo hace con signAndEditExecutable: false).
const { join } = require("node:path");
const rcedit = require("rcedit");

exports.default = async function (contexto) {
  if (contexto.electronPlatformName !== "win32") return;
  const nombre = contexto.packager.appInfo.productFilename;
  await rcedit(join(contexto.appOutDir, `${nombre}.exe`), {
    icon: join(__dirname, "icon.ico"),
    "version-string": { ProductName: "Reels Iglesia", FileDescription: "Reels Iglesia", CompanyName: "Reels Iglesia" },
  });
};
