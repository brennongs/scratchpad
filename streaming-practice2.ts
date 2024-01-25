import { Readable, Transform, pipeline } from 'stream'
import { createWriteStream } from 'fs'

// ===== DATA ===== //
const AVAILABLE_DATES = ['2023-11-15', '2023-11-14', '2023-11-13']
const pickRandomDate = () => AVAILABLE_DATES[Math.floor(Math.random() * AVAILABLE_DATES.length)]
class Data {
  date: string
  value: number
  constructor(date: string) {
    const dateMachine: {[key: string]: number } = {
      '2023-11-15': 1,
      '2023-11-14': 2,
      '2023-11-13': 3,
      'default': 0
    }
    this.date = date
    this.value = dateMachine[date || 'default']
  }
}
const makeData = (date: string) => new Data(date)
const DATA_STORE = Array.from(
  { length: 15 },
  () => makeData(pickRandomDate())
)
console.log(DATA_STORE)

// ===== UTILS ===== //
class FormatTransformer extends Transform {
  constructor() {
    super({ objectMode: true })
  }

  _transform(
    chunk: Data,
    _: BufferEncoding,
    next: () => void
  ) {
    this.push({
      date: chunk.date,
      value: new Array(chunk.value)
      .fill(String(chunk.value))
      .join('')
      .concat('\n')
    })
    next()
  }
}
// class CountTransformer extends Transform {
//   private count: number;
//   constructor(private value: string) {
//     super({ objectMode: true })
//   }

//   _transform(
//     chunk: Data[],
//     encoding: BufferEncoding,
//     next: () => void
//   ) {
//     this.count++
//   }

//   _flush(next: () => void) {
//     console.log(this.count)
//     next()
//   }
// }
class DateFilterTransformer extends Transform {
  constructor(private date: string) {
    super({ objectMode: true })
  }

  _transform(
    chunk: Data,
    encoding: BufferEncoding,
    next: () => void
  ) {
    console.log(chunk)
    if (chunk.date === this.date) {
      this.push(chunk)
    }
    next()
  }
}
class StringTransformer extends Transform {
  constructor() {
    super({ objectMode: true })
  }

  _transform(
    chunk: Data,
    encoding: BufferEncoding,
    next: () => void
  ) {
    this.push(String(chunk.value))
    next()
  }
}
function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
async function sleepRand() {
  const ms = Math.random() * 1000
  await sleep(ms)
}
async function fetch(index: number) {
  await sleepRand()
  return DATA_STORE[index]
}
async function* getAll(indeces: IterableIterator<number>) {
  for(const index of indeces) {
    await sleepRand()
    yield (await fetch(index))
  }
}

class ManagerTransformer extends Transform {
  private dates: string[] = [];

  constructor(private reader: Readable) {
    super({objectMode: true})
  }

  _transform(chunk: Data, _: BufferEncoding, next: () => void) {
    const date = chunk.date
    console.log(date, this.dates)
    if(!this.dates.includes(date)) {
      this.dates.push(chunk.date)
      pipeline(
        this.reader,
        new DateFilterTransformer(date),
        new StringTransformer(),
        createWriteStream(`./${date}.txt`),
        (error) => {
          if (error) console.error(error);
        }
      )
      this.reader.push(chunk)
    }
    next()
  }
}

// ===== LOGIC ===== //
console.log(DATA_STORE.length)
const reader = pipeline(
  Readable.from(getAll(Array(DATA_STORE.length).keys())),
  new FormatTransformer(),
  (e) => { if (e) console.error(e) }
)


const initial = pipeline(
  reader,
  new ManagerTransformer(reader),
  (error) => {
    if (error) console.error(error)
  }
)
// AVAILABLE_DATES.forEach(evaluatedDate => {
//   pipeline(
//     initial,
//     new DateFilterTransformer(evaluatedDate),
//     new StringTransformer(),
//     createWriteStream(`./${evaluatedDate}.txt`),
//     deleteTransformer(err) => {
//       if (err) console.error(err)
//     }
//   )
// })