interface Options {
  offset?: number;
  limit?: number;
  throttle?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function randsleep(): Promise<void> {
  const ms = Math.random() * 1000
  await sleep(ms)
}

const model = {
  total: 30,
  async fetchAll({ offset, limit }: Required<Omit<Options, 'throttle'>>) {
    // offset = 300 , limit = 50, total = 320
    // expect final iteration to return 20
    await randsleep()
    if (offset + limit > this.total) {
      console.log('bigger')
      console.log(Math.abs(this.total - (offset + limit)))
      return new Array(Math.abs(this.total - (offset + limit))).fill('')
    }
    if (offset >= this.total) return []
    return new Array(limit).fill('yayayaya')
  }
}

function makeIncrementor() {
  let count = 0;

  return () => (++count)
}


async function batchRequests(options: Options): Promise<void> {
  const promises: Promise<void>[] = []
  let query = {
    offset: options.offset ?? 0,
    limit: options.limit ?? 5,
  };
  let finished = false;
  const increment = makeIncrementor()
  const processBatch = async (results: any[]) => {
    console.log(results.length)
    query.offset += results.length
    await randsleep()
  }

  do {
    const batch = await model.fetchAll(query)
    if (batch.length) {
      query.offset += batch.length
      const promise = processBatch(batch)
      console.log(promise)
      promises.push(promise.then(() => {
        const index = promises.findIndex(p => p === promise)
        console.log(index)
        promises.splice(index, 1)
      }))
        // Once we hit our concurrency limit, wait for at least one promise to
        // resolve before continuing to batch off requests
        if (promises.length >= (options.throttle || 2)) {
          await Promise.race(promises);
        }
    } else {
      finished = true
    }
  } while (!finished);

  // Wait for remaining batches to finish
  Promise.all(promises);
}

batchRequests({ limit: 100, throttle: 5 });