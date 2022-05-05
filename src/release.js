const fs = require("fs")
const path = require("path")
const archiver = require("archiver")
const Listr = require("listr")
const { Observable } = require("rxjs")

const clientDataPath = path.resolve(__dirname, "..", "client")
const outputDirectory = path.resolve(__dirname, "..", "release")
const gameDataBundlePath = path.join(outputDirectory, "gamedata.zip")

const tasks = new Listr([
    {
        title: "🗂 Create directories",
        task: () => {

            if (fs.existsSync(outputDirectory)) {
                fs.rmdirSync(outputDirectory, { recursive: true })
            }

            fs.mkdirSync(outputDirectory)
        }
    },
    {
        title: "🗄 Compress client GameData",
        task: async (ctx, task) => {
            return new Observable(observer => {
                const outputWrite = fs.createWriteStream(gameDataBundlePath)

                const gamedataBundle = archiver("zip", {
                    zlib: { level: 9 }
                })

                outputWrite.on("close", () => {
                    observer.next(`Compressed [${gameDataBundlePath}] with ${gamedataBundle.pointer()} total bytes`)
                    observer.complete()
                })

                gamedataBundle.on("error", (err) => {
                    observer.error(error.message)
                    process.exit(1)
                })
                
                gamedataBundle.pipe(outputWrite)

                gamedataBundle.directory(clientDataPath, false)

                gamedataBundle.finalize()
            })
        }
    },
    {
        title: "📦 Create release",
        task: async (ctx, task) => {

        }
    }
])

tasks.run().catch(err => {
    console.error(err)
})