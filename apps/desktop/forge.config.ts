import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: "com.clarityv3.app",
    win32metadata: {
      CompanyName: "Clarity",
      FileDescription: "Clarity v3",
      ProductName: "Clarity v3",
    },
    asar: {
      unpack: "**/node_modules/better-sqlite3/**/*",
    },
    icon: "assets/icon",
    extraResource: [
      "assets/icon.ico",
      "assets/Click.wav",
      "assets",
    ],
    executableName: "ClarityV3",
  },
  rebuildConfig: {},
  makers: [
    // Windows: only builds on Windows OS (requires .NET Framework + Squirrel)
    // To build: run `npm run make` on Windows, or use GitHub Actions with windows-latest
    new MakerSquirrel({
      setupIcon: "assets/icon.ico",
    }),
    new MakerZIP({}, ["darwin", "win32"]),
    new MakerDeb({
      options: {
        icon: "assets/icon.png",
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: "src/main/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/preload.ts",
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
