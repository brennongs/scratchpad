type Trigger<Return> = () => Promise<Return>
/**
 * Performs a list of callable actions (promise factories) so
 * that only a limited number of promises are pending at any
 * given time.
 *
 * @param triggers An array of callable functions,
 *     which should return promises.
 * @param limit The maximum number of promises to have pending
 *     at once.
 * @returns A Promise that resolves to the full list of values
 *     when everything is done.
 */
async function throttleBy(limit: number, triggers: Trigger<any>[]) {
  // We'll need to store which is the next promise in the list.
  let currentIndex = 0;
  let results = new Array(triggers.length);

  async function proceed(): Promise<any> {
    if (currentIndex < triggers.length) {
      // Save the current value of i, so we can put the result
      // in the right place
      let nextIndex = currentIndex++;
      let nextTrigger = triggers[nextIndex];
      const result = await nextTrigger();

      results[nextIndex] = result;

      return proceed();
    }
  }

  await Promise.all(triggers.slice(0, limit).map(() => proceed()))

  return results
}

// Test harness:

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  });
}

async function fetch(index: number) {
  console.log(`begin ${index}`)
  await sleep(Math.random() * 3000)
  console.log(`end ${index}`)
  return index
}

const triggers = Array.from({ length: 10 }, (_, i) => () => fetch(i))
throttleBy(3, triggers)
  .then(console.log);