import { pipeline, Readable } from 'stream'
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

class Tester {
  content = ['test', 'test', 'test']

  sayContent() {
    pipeline(
      Readable.from(this.content),
      this.generateContent,
      process.stdout,
      (err) => { if (err) console.log(err); }
    )
  }

  async asyncSayContent() {
    await sleep(300)
  }

  private async *generateContent(upstream: Readable): AsyncGenerator<string, void, unknown> {
    console.log(this)
    for await (const chunk of upstream) {
      console.log(this)
      await sleep(300);
      yield chunk
    }
  }
}

(async () => {
  const tester = new Tester()
  tester.sayContent()
})()