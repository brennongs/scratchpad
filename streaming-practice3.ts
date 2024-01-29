import { Readable, Writable } from 'stream'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'

// ===== UTILITIES ===== //
async function fetch(action: Function) {
  await new Promise(resolve => {
    setTimeout(resolve, Math.random() * 1000)
  })
  
  return action()
}
class Archive {
  createWriteStream(path: string): Promise<Writable> {
    const writeStream = createWriteStream('/dev/null')
    
    if (path === './tmp/2023-11-13.txt') {
      setTimeout(() => {
        writeStream.emit('error', 'noooooo')
      }, 1000)
    }

    return fetch(() => writeStream)
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
  private availableDates: string[] = [
    '2023-11-15',
    '2023-11-14',
    '2023-11-13',
    '2024-01-01',
    '2024-01-02',
    '2024-01-09',
    '2024-01-12',
    '2024-01-14'
  ]

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
    await fetch(() => {})
    ids.forEach(id => {
      this.data.splice(this.data.findIndex(data => data.id === id), 1)
    })
  }
}


// ===== LOGIC ===== //
type Trigger = () => Promise<void>
class Command {
  batchToDelete: number[] = []
  abortController = new AbortController()

  constructor(
    private repository: Repository,
    private archive: Archive
  ) { }

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

  private async throttle(triggers: Trigger[]) {
    const { signal } = this.abortController

    async function proceed(): Promise<void> {
      if (signal.aborted) {
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

  private async prepareTriggers(): Promise<Trigger[]> {
    const dates = await this.repository.getAvailableDates()
    const signal = this.abortController.signal

    return dates.map(date => async () => {
      console.log(`Processing ${date}`)

      await pipeline(
        ...(await Promise.all([
          this.repository.getAllByDate(date),
          this.prepareDeleteTransform(),
          this.archive.createWriteStream(`./tmp/${date}.txt`)
        ])),
        { signal }
      ).catch((error) => {
        throw new Error(`Failed to process ${date}: ${error}`)
      })

      console.log(`Finished processing ${date}`)
    })
  }

  private async prepareDeleteTransform(): Promise<(upstream: Readable) => AsyncGenerator<string, void, unknown>> {
    const { repository, batchToDelete } = this

    return async function* (upstream) {
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
  }
}

// ===== RUNNER ===== //
(async function main() {
  await new Command(
    new Repository(),
    new Archive()
  ).execute()
})()