import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: "com.clarity.app", // macOS
    win32metadata: {
      CompanyName: "Clarity",
      FileDescription: "Clarity",
      ProductName: "Clarity",
    },
    asar: {
      unpack: "**/node_modules/better-sqlite3/**/*", // Unpack better-sqlite3 from ASAR
    },
    icon: "./assets/icon", // Base app icon (Forge adds .ico/.icns/.png as needed)
    extraResource: [
      "./assets/icon.ico",
      "./assets/Click.wav",
      "./assets", // copy the whole folder so all assets are available
    ],
    executableName: "Clarity",
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      setupIcon: "./assets/icon.ico", // Windows installer icon
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({
      options: {
        icon: "./assets/icon.png", // Linux RPM icon
      },
    }),
    new MakerDeb({
      options: {
        icon: "./assets/icon.png", // Linux DEB icon
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
