// this is a calculator
// It calculates how much data will be used in google cloud storage over time
// based on what file encoding we use.
import { Readable, Transform, pipeline } from 'stream'

// sample data
const one = {
  inserted_date: "2023-10-19 13:01:52.536683+00",
  updated_date: "2023-10-23 17:27:47.318614+00",
  deleted_date: null,
  id: "78b28821-2823-4823-8fc3-c2c0deb89cff",
  firestore_id: "/users/Ok6HyNDzeKOUjBmRZhzou0J16ki1/notifications/U1T9E225II34JwpWctW8",
  user_id: "Ok6HyNDzeKOUjBmRZhzou0J16ki1",
  payload: JSON.stringify({
    "jobId": "6798866353",
    "userId": "WKB34LHSP3hMsjfOiOz1UPURzB72",
    "shiftId": 47912528,
    "photoURL": "https://firebasestorage.googleapis.com/v0/b/nursa-stage.appspot.com/o/CredentialsPhotos%2FWKB34LHSP3hMsjfOiOz1UPURzB72%2F1696606498822_Screenshot%202023-10-06%20at%2008.56.24.png?alt=media&token=f477d3a2-7978-4181-9b79-3185b2649d9b",
    "shiftNumber": "1/1",
    "facilityUserId": null
  }),
  title: "Shift report has been completed!",
  notification_message: "Shift Report | Gordon Tester011, @ Daniela Hospital Test, AG, OR, and Waffles on October 5, 2023 13:52",
  type: "JOB_SHIFT_REPORT_REMINDER",
  photo_url: "https://firebasestorage.googleapis.com/v0/b/nursa-stage.appspot.com/o/CredentialsPhotos%2FWKB34LHSP3hMsjfOiOz1UPURzB72%2F1696606498822_Screenshot%202023-10-06%20at%2008.56.24.png?alt=media&token=f477d3a2-7978-4181-9b79-3185b2649d9b",
  is_read: true
}

/**
 * Convert bytes to human readable file size 
 * @param size in bytes
 * @returns human readable file size
 */
function humanFileSize(size: number) {
  var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  return Number((size / Math.pow(1024, i))).toFixed(2) + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

interface CSVOptions {
  headers?: string[]
  delimiter?: string
  newLine?: string
}
/**
 * This is more complicated than it should be for this example,
 * but it illustrates how powerful and dynamic transformers can be.
 * It takes data and transforms it into CSV line by line.
 * 
 * @headers The headers of the CSV file
 * @delimiter The delimiter of the CSV file -- default to ,
 * @newLine The new line of the CSV file -- default to \n
 */
class CSVTransform  extends Transform {
  headers: string[]
  delimiter: string
  newLine: string
  constructor(options: CSVOptions) {
    super({ objectMode: true })
    this.headers = options.headers || []
    this.delimiter = options.delimiter || ','
    this.newLine = options.newLine || '\n'

    this.push(this.headers.join(this.delimiter) + this.newLine)
  }

  _transform(data: any, encoding: string, callback: () => void) {
    const line = this.headers.map((header) => (
      data[header] ?? ''
    )).join(this.delimiter)

    this.push(line + this.newLine)
    callback()
  }
}

interface SizeOptions {
  multiplier?: number
  tag: string
}
/**
 * This one is simple, just takes the size of the data
 * and makes it human readable, again line by line.
 */
class SizeTransform extends Transform {
  private size = 0
  multiplier: number
  tag: string

  constructor(options?: SizeOptions) {
    super({ objectMode: true })
    this.multiplier = options?.multiplier ?? 1
    this.tag = options?.tag || ''
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: () => void) {
    this.size += Buffer.from(chunk).byteLength
    callback()
  }

  _flush(callback: () => void) {
    this.push(`${this.tag}: ${humanFileSize(this.size * 200_000 * this.multiplier)}`)
    callback()
  }
}

// this represents how many days we want to multiply the size by.
// the calcualtion is
// size (of one notification) * 200,000 (per day) * multiplier = total size
const multiplier = 365

pipeline(
  Readable.from([one]),
  new CSVTransform({ headers: Object.keys(one) }),
  new SizeTransform({ multiplier, tag: 'CSV'}),
  process.stdout
)

pipeline(
  Readable.from(JSON.stringify([one])),
  new SizeTransform({ multiplier, tag: 'JSON String' }),
  process.stdout
)