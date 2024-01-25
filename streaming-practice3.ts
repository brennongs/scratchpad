import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'

// ===== UTILITIES ===== //
function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
async function sleepRand() {
  const ms = Math.random() * 1000
  await sleep(ms)
}
async function fetch(action: Function) {
  await sleepRand()
  return action()
}
class Archive {
  async createWriteStream(path: string) {
    const writeStream = createWriteStream(path)
    
    if (path === './tmp/2023-11-13.txt') {
      setTimeout(() => {
        writeStream.emit('error', 'noooooo')
      }, 2000)
    }

    await sleepRand() 
    return writeStream
  }
}

// ===== DATA ===== //
let nextId = 1
class Datum {
  id: number
  date: string

  constructor(date: string) {
    this.date = date
    this.id = nextId++
  }
}
class Repository {
  data: Datum[] = []
  private availableDates: string[] = ['2023-11-15', '2023-11-14', '2023-11-13', '2024-01-01', '2024-01-02', '2024-01-09', '2024-01-12', '2024-01-14']

  constructor() {
    this.availableDates.forEach(date => {
      this.data.push(...Array.from(
        { length: Math.ceil(Math.random() * 1000) },
        () => new Datum(date)
      ))
    })
  }

  getAvailableDates(): Promise<string[]> {
    return fetch(() => (this.availableDates))
  }

  getAllByDate(date: string) {
    return fetch(() => Readable.from(
      this.data.filter(datum => datum.date === date)
    ))
  }

  async deleteBy({ ids }: { ids: number[] }): Promise<void> {
    await sleepRand()

    ids.forEach(id => {
      this.data.splice(this.data.findIndex(data => data.id === id), 1)
    })
  }
}


// ===== LOGIC ===== //
class Command {
  batchToDelete: number[] = []
  abortController: AbortController

  constructor(
    private repository: Repository,
    private archive: Archive
  ) {
    this.abortController = new AbortController()
  }

  async execute() {
    console.log('Executing test')

    try {
      await this.throttle(await this.prepareTriggers())
    } catch (error) {
      console.error(error)
      this.abortController.abort()
    } finally {
      this.cleanup()
    }
  }

  private async throttle(triggers: (() => Promise<void>)[]) {
    const proceed = async (): Promise<void> => {
      if (this.abortController.signal.aborted) {
        triggers.splice(0)
        return; 
      }

      const next = triggers.shift()

      if (next) {
        await next()
        return proceed()
      }
    }

    await Promise.all(triggers.slice(0, 3).map(proceed))
  }

  private async prepareTriggers(): Promise<(() => Promise<void>)[]> {
    const dates = await this.repository.getAvailableDates()
    const signal = this.abortController.signal

    return dates.map(date => async () => {
      console.log(`Processing ${date}`)

      const [readStream, deleteTransform, writeStream] = await Promise.all([
        this.repository.getAllByDate(date),
        this.prepareDeleteTransform(),
        this.archive.createWriteStream(`./tmp/${date}.txt`)
      ])

      await pipeline(
        readStream,
        deleteTransform,
        writeStream,
        { signal }
      ).catch((error) => {
        throw new Error(`Failed to process ${date}: ${error}`)
      })

      console.log(`Finished processing ${date}`)
    })
  }

  private prepareDeleteTransform() {
    const { repository, batchToDelete } = this

    return async function* (upstream: Readable): AsyncGenerator<string, void, unknown> {
      for await (const datum of upstream) {
        if (batchToDelete.length >= 100) {
          await repository.deleteBy({ ids: batchToDelete.splice(0) })
        }

        batchToDelete.push(datum.id)
        yield `${JSON.stringify(datum)}\n`
      }
    }
  }

  private async cleanup() {
    console.log('Cleaning up')
    
    if (this.batchToDelete.length) {
      await this.repository.deleteBy({ ids: this.batchToDelete })
    }

    console.log(this.repository.data)
  }
}

// ===== RUNNER ===== //
(async function main() {
  await new Command(
    new Repository(),
    new Archive()
  ).execute()
})()