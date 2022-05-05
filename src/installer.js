const repoConfig = ["srgooglo", "metamierda_modpack"]

import fs from "fs"
import path from "path"
import os from "os"
import axios from "axios"
import listr from "listr"
import fse from "fs-extra"
import extract from "extract-zip"

import downloader from "./lib/downloader.js"

const releasesApi = `https://api.github.com/repos/${repoConfig[0]}/${repoConfig[1]}/releases`
const gameDataPath = path.resolve(os.homedir(), repoConfig[1])
const gameDataBundlePath = path.resolve(os.homedir(), `${repoConfig[1]}.bundle`)

let minecraftGameFolder = null
let profilesFilePath = null
let latestRelease = null
let gamedataAsset = null

const tasks = new listr([
    {
        title: "🔭 Resolve directory",
        task: () => {
            switch (os.type()) {
                case "Darwin":
                    minecraftGameFolder = path.join(
                        os.homedir(),
                        "/Library",
                        "Application Support",
                        "minecraft"
                    );
                    break;

                case "win32":
                case "Windows_NT":
                    minecraftGameFolder = path.join(
                        process.env.APPDATA ||
                        path.join(os.homedir(), "AppData", "Roaming"),
                        ".minecraft"
                    );
                    break;
                default:

                    minecraftGameFolder = path.join(os.homedir(), ".minecraft");
                    break;
            }

            profilesFilePath = path.join(minecraftGameFolder, "launcher_profiles.json");
        }
    },
    {
        title: "📦 Get latest release",
        task: async () => {
            const response = await axios.get(releasesApi, {
                headers: {
                    responseType: "json"
                }
            })

            let releases = response.data

            releases = releases.filter((release) => {
                if (release.prerelease) {
                    if (process.argv.includes("--previews")) {
                        return true
                    }

                    return false
                }

                return true
            })


            latestRelease = releases[0]

            if (!latestRelease) {
                throw new Error("No releases found")
            }
        }
    },
    {
        title: "🖇 Get assets",
        skip: () => !Array.isArray(latestRelease?.assets),
        task: () => {
            if (!Array.isArray(latestRelease.assets)) {
                return false
            }

            gamedataAsset = latestRelease.assets.find((asset) => {
                return asset.name.includes("gamedata")
            })
        }
    },
    {
        title: "📂 Create directory",
        skip: () => gamedataAsset === null,
        task: () => {
            if (fs.existsSync(gameDataPath)) {
                if (fs.lstatSync(gameDataPath).isDirectory()) {
                    fs.rmSync(gameDataPath, { force: true, recursive: true })
                } else {
                    fs.unlinkSync(gameDataPath)
                }
            }

            fs.mkdirSync(gameDataPath, { recursive: true })
        }
    },
    {
        title: "💾 Download client",
        skip: () => gamedataAsset === null,
        task: (ctx, task) => {
            return new Promise(async (resolve, reject) => {
                const outputWrite = fs.createWriteStream(gameDataBundlePath)

                await downloader(gamedataAsset.url, outputWrite, (process) => {
                    const percentage = process.toFixed(2) * 100

                    task.title = `💾 Downloading ${percentage}%`
                })

                return resolve()
            })
        }
    },
    {
        title: "🛠 Extract client",
        skip: () => gamedataAsset === null,
        task: () => {
            return new Promise(async (resolve, reject) => {
                await extract(gameDataBundlePath, {
                    dir: gameDataPath
                })

                return resolve()
            })
        }
    },
    {
        title: "🏷 Create profile",
        enabled: () => {
            return fs.existsSync(profilesFilePath)
        },
        task: async (ctx, task) => {
            let launcherJSON = fs.readFileSync(profilesFilePath, "utf8")

            launcherJSON = JSON.parse(launcherJSON)

            launcherJSON.profiles["metamierda_modpack"] = {
                created : "2022-05-05T12:49:42.002Z",
                gameDir : gameDataPath,
                javaArgs : "-Xmx4G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M",
                lastVersionId: latestRelease.name,
                name : latestRelease.name,
                type: "custom",
                version: latestRelease.name,
                icon: "Chest",
            }

            fs.writeFileSync(profilesFilePath, JSON.stringify(launcherJSON, null, 2))

            fse.copySync(path.join(gameDataPath, "versions"), path.join(minecraftGameFolder, "versions"))
        }
    },
    {
        title: "🧼 Cleanup",
        task: () => {
            fs.unlinkSync(gameDataBundlePath)
        }
    }
])

tasks.run().catch(err => {
    console.error(err)
})

process.on("exit", () => {
    console.log("\n\n\t Finished. Exiting on 3 seconds...")

    setTimeout(() => {
        process.exit(0)
    }, 3000)
})